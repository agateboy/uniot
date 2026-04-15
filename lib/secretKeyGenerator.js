// ==========================================
// FUNÇÃO: Gerar Secret Key Único (6 caracteres)
// ==========================================
function generateSecretKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 6; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

module.exports = { generateSecretKey };
