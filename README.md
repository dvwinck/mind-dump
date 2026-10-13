# 🧠 Mind Dump

**Bloco de notas para dump mental** - Uma SPA + PWA offline-first para organizar pensamentos em categorias.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
[![CI](https://github.com/dvwinck/mind-dump/actions/workflows/ci.yml/badge.svg)](https://github.com/dvwinck/mind-dump/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dvwinck/mind-dump/actions/workflows/codeql.yml/badge.svg)](https://github.com/dvwinck/mind-dump/actions/workflows/codeql.yml)

🌐 **Demo:** https://dvwinck.github.io/mind-dump/

## ✨ Funcionalidades

- ✅ **Criar notas rapidamente** - Digite texto e pressione Enter
- ✅ **6 categorias fixas** para organização:
  1. Demandas com pouca clareza
  2. Sentimentos
  3. Projetos
  4. Desejos
  5. Tarefas
  6. Não fazer
- ✅ **Mover notas entre categorias** - Drag & drop ou menu "Mover para..."
- ✅ **Editar notas** - Modal de edição com Ctrl+Enter para salvar
- ✅ **Excluir notas** - Com confirmação
- ✅ **Fixar notas** (pin) - Notas fixadas aparecem no topo
- ✅ **Buscar/filtrar** - Busca em tempo real por texto
- ✅ **Persistência** - Auto-save em localStorage
- ✅ **Exportar JSON** - Backup completo das notas
- ✅ **Importar JSON** - Merge inteligente (mantém mais recente por updatedAt)
- ✅ **PWA** - Funciona offline após primeiro carregamento
- ✅ **Responsivo** - Kanban (desktop) / Tabs (mobile)
- ✅ **Dark mode** - Segue preferência do sistema
- ✅ **Acessibilidade** - Navegação por teclado, ARIA, skip link

## 🚀 Como Executar

### Opção 1: Servidor estático (recomendado)
```bash
cd mind-dump
npx serve
# Abrir http://localhost:3000
```

### Opção 2: Python
```bash
cd mind-dump
python -m http.server 3000
# Abrir http://localhost:3000
```

### Opção 3: VS Code Live Server
Instale a extensão "Live Server" e clique em "Go Live"

## 🧪 Testes

```bash
# Instalar dependências
npm install

# Rodar testes
npm test

# Rodar testes em modo watch
npm run test:watch

# Rodar testes com coverage
npm run test:coverage
```

Rode `npm test` para ver o resultado atual.

## 📁 Estrutura do Projeto

```
mind-dump/
├── index.html          # HTML principal (layout Kanban/Tabs)
├── manifest.json       # PWA manifest
├── service-worker.js   # Service Worker para cache offline
├── package.json        # Dependências e scripts
├── vitest.config.js    # Configuração de testes
├── README.md           # Documentação
├── icons/
│   ├── icon-192.png    # Ícone PWA 192x192
│   ├── icon-512.png    # Ícone PWA 512x512
│   └── *.svg           # Ícones SVG fonte
├── src/
│   ├── main.js         # Entrada do app + registro SW
│   ├── categories.js   # Lista única de categorias
│   ├── storage.js      # API de persistência (localStorage)
│   ├── render.js       # HTML das notas (sempre escapado)
│   ├── toast.js        # Avisos na tela
│   ├── update-flow.js  # Decide o que cada aba faz quando chega uma nova versão
│   └── ui.js           # UI, eventos, drag & drop
├── vendor/
│   └── bootstrap/      # Bootstrap 5.3.2 local (css + js)
├── styles/
│   └── app.css         # Estilos (incluindo dark mode)
└── tests/              # Testes (Vitest + jsdom)
```

## 📋 Modelo de Nota

```javascript
{
  id: string,         // ID único (timestamp + random)
  text: string,       // Conteúdo da nota
  category: string,   // 'unclear' | 'feelings' | 'projects' | 'desires' | 'tasks' | 'not-do'
  pinned: boolean,    // Se está fixada
  createdAt: string,  // ISO timestamp
  updatedAt: string   // ISO timestamp
}
```

## 🔧 Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
- **UI Framework:** Bootstrap 5.3.2 (local, em `vendor/bootstrap/`)
- **Persistência:** localStorage
- **PWA:** Service Worker + manifest.json
- **Testes:** Vitest + jsdom
- **Drag & Drop:** HTML5 Drag and Drop API

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Enter` | Criar nota (no campo de texto) |
| `Shift+Enter` | Nova linha (no campo de texto) |
| `Ctrl+Enter` | Salvar nota (no modal de edição) |
| `Tab` | Navegar entre elementos |
| `Esc` | Fechar modal |

## 🌙 Dark Mode

O app detecta automaticamente a preferência do sistema:
- `prefers-color-scheme: dark` → Tema escuro
- `prefers-color-scheme: light` → Tema claro

## ♿ Acessibilidade

- Skip link para navegação por teclado
- Os botões de ação das notas (fixar, editar, mover, excluir) têm `aria-label`
- Foco visível em todos os elementos interativos
- Suporte a `prefers-reduced-motion`
- Suporte a `prefers-contrast: high`
- Áreas de toque mínimo de 44x44px em dispositivos touch

## 📤 Exportar / 📥 Importar

### Exportar
Clique em "Exportar" para baixar um arquivo JSON com todas as notas.

### Importar
1. Clique em "Importar"
2. Selecione um arquivo `.json`
3. O merge é automático:
   - Notas novas são adicionadas
   - Notas existentes (mesmo ID) são atualizadas se o arquivo importado tiver `updatedAt` mais recente

## 🔒 Privacidade

- **100% local** - Nenhum dado é enviado para servidores
- Dados armazenados apenas no localStorage do navegador
- Exportação para backup pessoal

## 📱 PWA - Instalação

1. Acesse o app no navegador (Chrome, Edge, Safari)
2. Clique em "Instalar" (aparece na barra de endereço ou menu)
3. O app fica disponível offline e pode ser aberto como aplicativo nativo

## 🛠️ Desenvolvimento

### Adicionar nova categoria
1. Edite `CATEGORIES` em `src/categories.js` (a validação de importação já usa essa lista)
2. Em `index.html`, adicione a coluna do desktop, o botão da aba (`id="tab-<id>"`) e o painel (`id="panel-<id>"`) com a coluna do mobile; `npm test` falha se faltar qualquer um deles
3. Adicione a cor da categoria em `styles/app.css`

### Publicar uma nova versão
Troque `CACHE_NAME` em `service-worker.js` sempre que um arquivo em cache mudar. Se criar um arquivo novo, inclua-o em `ASSETS_TO_CACHE` (o teste `tests/service-worker.test.js` avisa se faltar um módulo de `src/` ou um arquivo carregado pelo `index.html`; outros tipos de arquivo, como imagens usadas só pelo CSS, precisam ser lembrados à mão).

### Modificar estilo do card
Edite `.note-card` em `styles/app.css`

## 📄 Licença

MIT License - Sinta-se livre para usar, modificar e distribuir.

---

Feito com ❤️ para organizar a mente
