# 🚐 Scudo Control

App mobile PWA para gestão completa da **Fiat Scudo 2025** — abastecimentos, manutenções, planejamento de peças e controle de gastos, com sincronização em tempo real entre dispositivos via Firebase.

---

## 📁 Estrutura do projeto

```
scudo-control/
├── index.html                  # App principal (única página)
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker (offline)
├── firestore.rules             # Regras de segurança do Firestore
├── README.md
└── assets/
    ├── firebase-config.js      # ⚠️ Você edita este arquivo
    ├── app.js                  # Lógica do app (ES Module)
    ├── db.js                   # Camada Firestore (RemoteDB)
    └── icons/
        ├── icon-192.png        # Ícone PWA (substitua pelo seu)
        └── icon-512.png        # Ícone PWA grande (substitua pelo seu)
```

---

## 🔥 Passo 1 — Criar projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `scudo-control`) → Continue
4. Desative Google Analytics se quiser (opcional) → Criar projeto

---

## 🗃️ Passo 2 — Habilitar Firestore

1. No menu lateral: **Build → Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"** (as regras serão aplicadas)
4. Selecione a região mais próxima (ex: `us-east1` ou `southamerica-east1`)
5. Clique em **Ativar**

### Aplicar as regras de segurança

1. Na aba **Regras** do Firestore
2. Apague o conteúdo padrão e cole o conteúdo de `firestore.rules`
3. Clique em **Publicar**

---

## 🔐 Passo 3 — Habilitar Autenticação Google

1. No menu lateral: **Build → Authentication**
2. Clique em **"Primeiros passos"**
3. Aba **"Sign-in method"** → clique em **Google**
4. Ative o toggle → informe um e-mail de suporte
5. Clique em **Salvar**

---

## ⚙️ Passo 4 — Pegar a configuração do Firebase

1. Na página inicial do projeto, clique no ícone `</>` (Web)
2. Dê um apelido ao app (ex: `scudo-pwa`) → **Registrar app**
3. Copie o objeto `firebaseConfig` que aparece
4. Abra o arquivo `assets/firebase-config.js` e substitua:

```js
const FIREBASE_CONFIG = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};
```

> ✅ **Segurança:** O Firebase foi projetado para ter a config no frontend.  
> A proteção real vem das **Firestore Rules** (já configuradas).  
> Nunca coloque Service Account Keys (privadas) no frontend.

---

## 🌐 Passo 5 — Publicar no GitHub Pages

### 5.1 Criar repositório

1. Acesse [github.com/new](https://github.com/new)
2. Nome: `scudo-control` (ou qualquer nome)
3. Deixe **público** (necessário para Pages gratuito)
4. Clique em **Create repository**

### 5.2 Subir os arquivos

```bash
# Na pasta do projeto:
git init
git add .
git commit -m "Initial commit — Scudo Control PWA"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/scudo-control.git
git push -u origin main
```

### 5.3 Habilitar GitHub Pages

1. No repositório: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / pasta: `/ (root)`
4. Clique em **Save**
5. Aguarde ~1 min → URL será: `https://SEU_USUARIO.github.io/scudo-control/`

### 5.4 Adicionar domínio ao Firebase Auth

Para que o login Google funcione no GitHub Pages:

1. Firebase Console → **Authentication → Settings → Authorized domains**
2. Clique em **Adicionar domínio**
3. Cole: `SEU_USUARIO.github.io`
4. Salvar

---

## 📱 Passo 6 — Instalar como app

### Android (Chrome)
1. Abra o link do GitHub Pages no Chrome
2. Menu `⋮` → **"Adicionar à tela inicial"**
3. Confirme → app instalado!

### iOS (Safari)
1. Abra no Safari (importante: não funciona no Chrome iOS)
2. Toque no ícone de compartilhar ↑
3. Role e toque em **"Adicionar à Tela de Início"**
4. Confirme → app instalado!

---

## 🔄 Como compartilhar entre celulares

1. Na **primeira vez**, o usuário A faz login e **cria o veículo** → recebe um código tipo `SCU-83K2`
2. O usuário A toca no **badge do código** (canto superior direito) para copiar
3. Envia o código para o usuário B via WhatsApp
4. O usuário B faz login → toca em **"Entrar em veículo existente"** → digita o código
5. Pronto — ambos veem os mesmos dados em tempo real ✅

---

## 🎨 Substituir o ícone do app

Os ícones atuais em `assets/icons/` são placeholders com fundo laranja e texto "SC".

Para usar seu ícone personalizado:

1. Crie ou exporte **dois arquivos PNG**:
   - `icon-192.png` → exatamente **192×192 pixels**
   - `icon-512.png` → exatamente **512×512 pixels**
2. Substitua os arquivos em `assets/icons/`
3. Dê commit e push para o GitHub

> 💡 **Dica:** Use [maskable.app](https://maskable.app/editor) para verificar se seu ícone funciona bem como "maskable" (bordas arredondadas no Android).

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│             index.html                  │
│  (HTML + CSS + registro do SW)          │
└────────────────┬────────────────────────┘
                 │ importa
    ┌────────────▼─────────────┐
    │       assets/app.js      │  ← Toda lógica de UI
    │  (ES Module, navegador)  │
    └────────────┬─────────────┘
                 │ importa
    ┌────────────▼─────────────┐
    │       assets/db.js       │  ← Camada Firestore
    │  (RemoteDB, listeners)   │
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │   Firebase Firestore     │  ← Banco na nuvem
    │   Firebase Auth (Google) │  ← Autenticação
    └──────────────────────────┘

Service Worker (sw.js):
  - Cache-first para assets (JS, CSS, ícones)
  - Network-first para index.html
  - Ignora requisições Firebase (sempre online)
```

### Modelo de dados Firestore

```
vehicles/
  {vehicleId}/          ← ex: "SCU-83K2"
    name: string
    ownerUid: string
    members: { uid: true }
    createdAt: timestamp
    state: { km: number, placa: string }
    
    fuel/
      {docId}/
        data, km, litros, preco, tipo, posto, consumo, total
    
    manut/
      {docId}/
        tipo, data, km, custo, desc, oficina
    
    plano/
      {docId}/
        item, cat, ultimaKm, intervaloKm, ultimaDt, intMeses, obs
    
    gastos/
      {docId}/
        cat, data, valor, desc
```

---

## 🛠️ Desenvolvimento local

Para testar localmente (obrigatório por causa dos ES Modules e SW):

```bash
# Opção 1 — Python
python3 -m http.server 8080

# Opção 2 — Node.js
npx serve .

# Opção 3 — VS Code
# Instale a extensão "Live Server" e clique em "Go Live"
```

Acesse: `http://localhost:8080`

> ⚠️ **Não abra o `index.html` diretamente** (`file://`) — ES Modules e Service Workers exigem um servidor HTTP.

---

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| "Popup bloqueado" no login | Permita popups no browser para o domínio |
| Código de veículo não encontrado | Verifique se o código está correto (maiúsculas, hífen) |
| App não instala no iOS | Abra no **Safari**, não no Chrome |
| Dados não sincronizam | Verifique conexão + regras do Firestore |
| Login não funciona no GitHub Pages | Adicione o domínio no Firebase Auth → Authorized domains |

---

## 📋 Checklist de deploy

- [ ] Criar projeto Firebase
- [ ] Habilitar Firestore (modo produção)
- [ ] Aplicar `firestore.rules`
- [ ] Habilitar Auth → Google
- [ ] Preencher `assets/firebase-config.js`
- [ ] Criar repositório GitHub e subir arquivos
- [ ] Habilitar GitHub Pages
- [ ] Adicionar domínio GitHub Pages no Firebase Auth
- [ ] Testar login em um celular
- [ ] Testar criação de veículo e código de convite
- [ ] Testar sincronização em dois dispositivos
- [ ] Substituir ícones placeholder pelos definitivos
- [ ] Instalar como PWA no Android e iOS
