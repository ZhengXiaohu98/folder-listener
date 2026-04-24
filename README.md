# Folder Listener

_Automated image monitoring, compression, and workflow automation._

Magic Folder is a professional-grade desktop utility designed to streamline your image processing pipeline. It monitors a designated "Source Folder" in real-time, automatically compresses incoming images based on your preferences, and saves them to a "Target Folder." With built-in logging and extensibility through Hooks, it's the perfect bridge between your local workspace and remote CMS or storage.

---

## Tech Stack

- **Core**: [Electron](https://www.electronjs.org/) (Cross-platform Desktop App)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Processing**: [Sharp](https://sharp.pixelplumbing.com/) (High-performance image processing)
- **Storage**: [SQLite3](https://github.com/TryGhost/node-sqlite3) (Persistent activity history)
- **UI/UX**: [Framer Motion](https://www.framer.com/motion/) + [Lucide Icons](https://lucide.dev/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ZhengXiaohu98/folder-listener.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Launch the application in development mode:

```bash
npm run dev
```

### Build

Generate a production-ready installer for your OS:

```bash
npm run build
```
