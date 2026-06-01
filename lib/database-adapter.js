/**
 * Database Adapter - Support MySQL & SQLite dengan interface yang sama
 * Automatically detect database type dari environment variables
 */

const mysql = require('mysql2');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Detect database type
const DB_TYPE = process.env.DB_TYPE || 'mysql';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'root123';
const DB_NAME = process.env.DB_NAME || 'uniot_db';

let db;
let dbType = 'unknown';

// ==== Database Adapter untuk MySQL & SQLite ====
class DatabaseAdapter {
    constructor(connection, type) {
        this.connection = connection;
        this.type = type;
    }

    // Adapter untuk db.run() - sama interface untuk both
    run(sql, params, callback) {
        if (this.type === 'mysql') {
            // MySQL: execute query
            this.connection.query(sql, params || [], (err, result) => {
                if (callback) {
                    callback.call({ lastID: result?.insertId, changes: result?.affectedRows || 0 }, err);
                }
            });
        } else {
            // SQLite: run query
            this.connection.run(sql, params || [], function(err) {
                if (callback) {
                    callback.call(this, err);
                }
            });
        }
    }

    // Adapter untuk db.all() - sama interface untuk both
    all(sql, params, callback) {
        // Handle optional params
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        if (this.type === 'mysql') {
            this.connection.query(sql, params || [], (err, results) => {
                if (callback) callback(err, results);
            });
        } else {
            this.connection.all(sql, params || [], (err, rows) => {
                if (callback) callback(err, rows);
            });
        }
    }

    // Adapter untuk db.get() - sama interface untuk both
    get(sql, params, callback) {
        // Handle optional params
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        if (this.type === 'mysql') {
            this.connection.query(sql, params || [], (err, results) => {
                if (callback) callback(err, results?.[0]);
            });
        } else {
            this.connection.get(sql, params || [], (err, row) => {
                if (callback) callback(err, row);
            });
        }
    }

    // Close connection
    close(callback) {
        if (this.type === 'mysql') {
            this.connection.end(callback);
        } else {
            this.connection.close(callback);
        }
    }
}

// ==== Connection Setup ====
function initializeDatabase(callback) {
    if (DB_TYPE === 'mysql') {
        initializeMySQL(callback);
    } else {
        initializeSQLite(callback);
    }
}

function initializeMySQL(callback) {
    console.log(`[${new Date().toISOString()}] Connecting to MySQL (${DB_HOST}:3306)...`);
    
    const connection = mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        supportBigNumbers: true,
        bigNumberStrings: true
    });

    connection.connect((err) => {
        if (err) {
            console.error('❌ MySQL Connection Error:', err.message);
            console.log('\n⚠️  Falling back to SQLite...');
            initializeSQLite(callback);
            return;
        }

        db = new DatabaseAdapter(connection, 'mysql');
        dbType = 'mysql';
        console.log('✓ Successfully connected to MySQL! 🔌');
        console.log(`  Host: ${DB_HOST}:3306`);
        console.log(`  Database: ${DB_NAME}`);
        
        if (callback) callback(null, db);
    });

    // Handle connection errors
    connection.on('error', (err) => {
        console.error('[MySQL Error]', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Database connection was closed.');
        }
        if (err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
            console.error('Database had a fatal error.');
        }
        if (err.code === 'PROTOCOL_ENQUEUE_AFTER_CLOSE') {
            console.error('Database connection was manually closed.');
        }
    });
}

function initializeSQLite(callback) {
    console.log(`[${new Date().toISOString()}] Connecting to SQLite (database.sqlite)...`);
    
    const connection = new sqlite3.Database(
        path.join(__dirname, 'database.sqlite'),
        (err) => {
            if (err) {
                console.error('❌ SQLite Connection Error:', err);
                if (callback) callback(err);
                return;
            }

            db = new DatabaseAdapter(connection, 'sqlite');
            dbType = 'sqlite';
            console.log('✓ Successfully connected to SQLite! 🔌');
            console.log('  File: database.sqlite');
            
            if (callback) callback(null, db);
        }
    );
}

// Helper function to get database-specific SQL for time range filtering
function getLastNDaysSQL(days = 1) {
    if (dbType === 'mysql') {
        return `DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
    } else {
        // SQLite
        return `datetime('now', '-${days} day')`;
    }
}

module.exports = {
    initializeDatabase,
    getDatabase: () => db,
    getDatabaseType: () => dbType,
    getLastNDaysSQL
};
