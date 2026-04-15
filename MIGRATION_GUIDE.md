# 🔄 MIGRAÇÃO: device_name → secret_key

## 📋 Resumo de Mudanças

| Aspecto | Antes (device_name) | Depois (secret_key) |
|--------|-------------------|-------------------|
| **Conexão ESP32** | `?device=smart_home` | `?key=aB5xQ9mK2pL...` |
| **Colisão de nomes** | ❌ Possível | ✅ Impossível |
| **Identificação** | Nome (string) | Chave única (32 chars) |
| **Segurança** | Fraca | ✅ Forte |
| **Multi-user** | Broadcasts para todos | ✅ Apenas seu user |

---

## 🔧 Passo a Passo da Migração

### Para Usuários Existentes:

#### 1. Fazer Backup (Opcional)
Antes de qualquer coisa, salve os dados antigos:
```bash
cp database.sqlite database.sqlite.backup
```

#### 2. Reiniciar o Servidor
O servidor carregará automaticamente e criará a coluna `secret_key`:
```bash
npm start
```

Se teve erro, execute migrations manualmente:
```sql
ALTER TABLE devices ADD COLUMN secret_key TEXT UNIQUE;
```

#### 3. Listar Devices Existentes
Os devices antigos **ainda funcionam temporariamente** com device_name, mas serão listados no dashboard.

#### 4. Regenerar Secret Keys
Cada vez que você cria um novo device, uma secret_key é gerada automaticamente.

Para devices antigos, você tem 2 opções:

**Opção A: Delete & Recria (Limpa)**
```javascript
// Dashboard
DELETE device "smart_home"  // Perde histórico
CREATE novo device          // Gera nova secret_key
```

**Opção B: Migration Script (Preserva dados)**
```sql
-- Script para gerar secret_keys em devices existentes
UPDATE devices 
SET secret_key = SUBSTR(hex(randomblob(16)), 1, 32)
WHERE secret_key IS NULL;
```

---

## 📄 Mudanças no Backend

### 1. Database Schema

```javascript
// ANTES
db.run(`CREATE TABLE IF NOT EXISTS devices (
    device_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL
)`);

// DEPOIS
db.run(`CREATE TABLE IF NOT EXISTS devices (
    device_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    secret_key TEXT UNIQUE NOT NULL
)`);
```

### 2. Device Registration

```javascript
// ANTES
app.post('/api/devices', (req, res) => {
    const { device_name } = req.body;
    db.run('INSERT INTO devices (user_id, device_name, api_key) VALUES (?, ?, ?)',
        [userId, device_name, '']);
});

// DEPOIS
app.post('/api/devices', (req, res) => {
    const { device_name } = req.body;
    const secretKey = generateSecretKey();  // Nova função
    db.run('INSERT INTO devices (user_id, device_name, api_key, secret_key) VALUES (?, ?, ?, ?)',
        [userId, device_name, '', secretKey]);
    res.json({ secret_key: secretKey });  // Retorna para copiar
});
```

### 3. WebSocket Connection

```javascript
// ANTES
if (deviceName && !token) {
    clientType = 'device';
    connClientKey = `device:${deviceName}`;
}

// DEPOIS
if (secretKey && !token) {
    const deviceInfo = secretKeyRegistry.get(secretKey);
    if (!deviceInfo) {
        ws.close(1008, 'Secret key não valid');
        return;
    }
    clientType = 'device';
    deviceId = deviceInfo.device_id;
    connClientKey = `device:${deviceId}`;
}
```

### 4. Device Lookup

```javascript
// ANTES
const deviceKey = allConnections.entries().find(
    ([key, val]) => val.deviceName === device
);

// DEPOIS
const deviceKey = allConnections.entries().find(
    ([key, val]) => val.deviceId === device_id
);
```

### 5. Broadcast

```javascript
// ANTES (Broadcast para todos)
function broadcastToAllDashboards(data) {
    allConnections.forEach((conn) => {
        if (conn.type === 'dashboard') conn.ws.send(JSON.stringify(data));
    });
}

// DEPOIS (Broadcast apenas para user)
function broadcastToUserDashboards(userId, data) {
    allConnections.forEach((conn) => {
        if (conn.type === 'dashboard' && conn.userId === userId) {
            conn.ws.send(JSON.stringify(data));
        }
    });
}
```

---

## 📄 Mudanças no Arduino Code

### 1. Configuração

```cpp
// ANTES
String ws_path = "/?device=" + String(nama_device);

// DEPOIS
String ws_path = "/?key=" + String(secret_key);
```

### 2. WebSocket URL

```
ANTES: ws://192.168.0.115:3001/?device=smart_home
DEPOIS: ws://192.168.0.115:3001/?key=aB5xQ9mK2pL7wR3nT6vC8jD1eF4hG0sK9
```

### 3. Query Parameter

```cpp
// ANTES
const parsedUrl = url.parse(req.url, true);
const deviceName = query.device;

// DEPOIS
const parsedUrl = url.parse(req.url, true);
const secretKey = query.key;
```

---

## ✅ Checklist de Migração

- [ ] Fazer backup do banco de dados (se tiver)
- [ ] Atualizar `index.js` com nova lógica de secret_key
- [ ] Reiniciar servidor: `npm start`
- [ ] Criar novo device na dashboard
- [ ] Copiar secret_key gerada
- [ ] Atualizar `ESP32_SECRET_KEY.ino` com secret_key
- [ ] Upload para ESP32
- [ ] Verificar Serial Monitor para "Terhubung"
- [ ] Testar envio de sensor data no dashboard
- [ ] Testar comando do dashboard para ESP32

---

## 🔄 Rollback (Se Necessário)

Se quiser voltar para device_name:

```bash
# 1. Restaurar backup
cp database.sqlite.backup database.sqlite

# 2. Reverter index.js para versão anterior (git revert)
git revert HEAD

# 3. Restart servidor
npm start
```

---

## 📊 Comparação: device_name vs secret_key

### Cenário: Múltiplos Usuários

```
User A          User B
└─Device 1      └─Device 1
  (smart_home)    (smart_home)  ← Nome igual! Conflito!
```

**Com device_name:** 
- Dashboard User A vê dados do Device User B
- Comandos se misturam
- ❌ Inseguro!

**Com secret_key:**
```
User A                    User B
└─Device 1               └─Device 1
  (key: aB5x...)          (key: kL2m...)
  └─ Dados só para A       └─ Dados só para B
     Comandos só para A       Comandos só para B
✅ Seguro!
```

---

## 🆘 Em Caso de Problemas

### Problema: Servidor não inicia após update

**Solução:**
```bash
# 1. Verifique se lib/secretKeyGenerator.js existe
ls lib/secretKeyGenerator.js

# 2. Se faltar, crie:
mkdir -p lib
echo 'function generateSecretKey() { ... }' > lib/secretKeyGenerator.js

# 3. Verifique dependências
npm install

# 4. Reinicie
npm start
```

### Problema: "Secret key não valid" no ESP32

**Solução:**
1. Copie novamente a secret_key (sem espaços)
2. Verifique se é exatamente 32 caracteres
3. Recrie o device se necessário

### Problema: Dados antigos desapareceram

**Causa:** Deletou device sem backup  
**Solução:** Restaure do `database.sqlite.backup`

---

## 📈 Roadmap Futuro

- [ ] UI para copiar/regenerar secret_key
- [ ] Expiração de secret_keys (ex: rotação mensal)
- [ ] Histórico de acesso (auditoria)
- [ ] Multiple secret_keys por device (backup key)
- [ ] QR Code para ler secret_key no mobile

