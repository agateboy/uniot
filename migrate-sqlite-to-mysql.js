#!/usr/bin/env node

/**
 * SQLite to MySQL Migration Script
 * Migrate data dari database.sqlite ke MySQL container
 */

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    envLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const separator = trimmed.indexOf('=');
        if (separator === -1) return;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim();
        if (key && process.env[key] == null) {
            process.env[key] = value;
        }
    });
}

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'uniot_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'uniot_pass';
const DB_NAME = process.env.DB_NAME || 'uniot_db';

let sqliteDb;
let mysqlConn;

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║  SQLite → MySQL Data Migration Tool    ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

// ===== CONNECT TO SQLite =====
async function connectSqlite() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, 'database.sqlite');
        
        if (!fs.existsSync(dbPath)) {
            console.log('❌ database.sqlite tidak ditemukan!');
            console.log(`   Path: ${dbPath}`);
            process.exit(1);
        }
        
        sqliteDb = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to SQLite:', err);
                process.exit(1);
            }
            console.log('✓ Connected to SQLite (database.sqlite)');
            resolve();
        });
    });
}

// ===== CONNECT TO MySQL =====
async function connectMysql() {
    return new Promise((resolve, reject) => {
        mysqlConn = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        mysqlConn.connect((err) => {
            if (err) {
                console.error('❌ Error connecting to MySQL:', err.message);
                console.log('\n💡 Pastikan:');
                console.log('   1. Docker container uniot_mysql sedang berjalan');
                console.log('   2. MySQL sudah fully initialized');
                console.log('   3. Coba lagi setelah beberapa detik');
                process.exit(1);
            }
            console.log(`✓ Connected to MySQL (${DB_HOST}:3306/${DB_NAME})`);
            resolve();
        });
    });
}

// ===== GET ALL TABLES FROM SQLite =====
async function getSqliteTables() {
    return new Promise((resolve, reject) => {
        sqliteDb.all(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
            (err, tables) => {
                if (err) {
                    console.error('❌ Error fetching tables:', err);
                    reject(err);
                    return;
                }
                resolve(tables.map(t => t.name));
            }
        );
    });
}

// ===== MIGRATE TABLE =====
async function migrateTable(tableName) {
    return new Promise(async (resolve, reject) => {
        // Get all rows dari SQLite
        sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
            if (err) {
                console.error(`❌ Error reading ${tableName}:`, err);
                resolve(0);
                return;
            }

            if (!rows || rows.length === 0) {
                console.log(`  ⊘ ${tableName}: 0 rows (skip)`);
                resolve(0);
                return;
            }

            // Insert ke MySQL
            let inserted = 0;
            let failed = 0;

            for (const row of rows) {
                const columns = Object.keys(row);
                const values = Object.values(row).map((val) => {
                    // Convert ISO timestamp to MySQL datetime format
                    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                        return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
                    }
                    // Truncate long strings (for varchar columns)
                    if (typeof val === 'string' && val.length > 255) {
                        return val.slice(0, 255);
                    }
                    return val;
                });
                
                const placeholders = columns.map(() => '?').join(', ');
                const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

                await new Promise((resolveInsert) => {
                    mysqlConn.query(sql, values, (err) => {
                        if (err) {
                            failed++;
                            // Only log critical errors (not duplicates)
                            if (failed <= 2 && !err.message.includes('Duplicate')) {
                                if (err.message.includes('Incorrect datetime')) {
                                    console.error(`    ${tableName}: Invalid datetime format`);
                                }
                            }
                        } else {
                            inserted++;
                        }
                        resolveInsert();
                    });
                });
            }

            const status = failed > 0 ? `⚠️  ${inserted}/${rows.length}` : `✓ ${inserted}`;
            console.log(`  ${status} ${tableName}`);
            resolve(inserted);
        });
    });
}

// ===== MAIN MIGRATION =====
async function migrate() {
    try {
        console.log('📋 Step 1: Connecting to databases...\n');
        await connectSqlite();
        await connectMysql();

        console.log('\n📋 Step 2: Disabling foreign key checks...\n');
        await new Promise((resolve) => {
            mysqlConn.query('SET FOREIGN_KEY_CHECKS=0', (err) => {
                if (err) console.error('Warning: Could not disable FK checks:', err);
                console.log('✓ Foreign key checks disabled');
                resolve();
            });
        });

        console.log('\n📋 Step 3: Clearing existing MySQL data...\n');
        const tablesToClear = ['sensor_data', 'control_commands', 'alerts', 'activity_logs', 'widgets', 'devices', 'users'];
        
        for (const table of tablesToClear) {
            await new Promise((resolve) => {
                mysqlConn.query(`TRUNCATE TABLE ${table}`, (err) => {
                    if (!err) {
                        console.log(`  ✓ Cleared ${table}`);
                    }
                    resolve();
                });
            });
        }

        console.log('\n📋 Step 4: Fetching table list...\n');
        const tables = await getSqliteTables();
        
        if (tables.length === 0) {
            console.log('⊘ No tables found in SQLite');
            console.log('✓ Migration complete (nothing to migrate)');
            process.exit(0);
        }

        // Define migration order (parent tables first for FK integrity)
        // Skip sqlite_sequence (SQLite internal table)
        const tableOrder = ['users', 'devices', 'widgets', 'sensor_data', 'alerts', 'activity_logs', 'control_commands'];
        const orderedTables = tableOrder.filter(t => tables.includes(t));
        const remainingTables = tables.filter(t => !orderedTables.includes(t) && t !== 'sqlite_sequence');
        const finalTables = [...orderedTables, ...remainingTables];

        console.log(`Found ${finalTables.length} table(s) to migrate:\n`);

        console.log('📋 Step 5: Migrating data...\n');
        let totalMigrated = 0;

        for (const table of finalTables) {
            const count = await migrateTable(table);
            totalMigrated += count;
        }

        console.log('\n📋 Step 6: Re-enabling foreign key checks...\n');
        await new Promise((resolve) => {
            mysqlConn.query('SET FOREIGN_KEY_CHECKS=1', (err) => {
                if (err) console.error('Warning: Could not enable FK checks:', err);
                console.log('✓ Foreign key checks enabled');
                resolve();
            });
        });

        console.log('\n');
        console.log('╔════════════════════════════════════════╗');
        console.log(`║  Migration Complete: ${totalMigrated} rows inserted  ║`);
        console.log('╚════════════════════════════════════════╝');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (sqliteDb) sqliteDb.close();
        if (mysqlConn) mysqlConn.end();
    }
}

// Start migration
migrate();
