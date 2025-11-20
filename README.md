# Research Automation

> 🤖 An intelligent personal research automation tool that uses AI to summarize newsletters, podcasts, and web articles, then organizes insights into your knowledge base.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.2+-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-success.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

- **🤖 AI-Powered Summaries**: Uses Claude Sonnet 4.5 to create insightful summaries with key takeaways and expert questions
- **📧 Email Integration**: Automatically processes newsletters from a dedicated Gmail inbox
- **🎧 Podcast Support**: Fetches and summarizes podcast transcripts from RSS feeds
- **🌐 Web Source Management**: Unified interface for managing email, RSS, and web article sources
- **🔗 Intelligent Link Management**: Extracts, enriches, and organizes links from all content
- **📊 Knowledge Base**: Builds a searchable database of insights, questions, and references
- **🎨 Modern Web Interface**: React + TypeScript UI with real-time processing updates
- **📋 Weekly Summaries**: Automatic weekly summary generation in your preferred format
- **🗂️ Obsidian Integration**: Direct export to Obsidian vault for seamless knowledge management
- **� Docker Ready**: Containerized for easy deployment across platforms
- **🔒 Privacy First**: All data stays local, no cloud dependencies required

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Docker** and **Docker Compose v2** installed ([Install Docker](https://docs.docker.com/get-docker/))
- **Gmail account** for receiving newsletters (dedicated account recommended)
- **Anthropic API key** for Claude ([Get API key](https://console.anthropic.com/))
- *Optional:* **LinkPreview API key** for enhanced link enrichment ([Get API key](https://www.linkpreview.net/))
- *Optional:* **Obsidian vault** for markdown exports ([Download Obsidian](https://obsidian.md/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/research-automation.git
   cd research-automation
   ```

2. **Initial setup**
   ```bash
   make setup
   ```
   This creates a `.env` file from the template.

3. **Configure your credentials**
   
   Edit the `.env` file with your API keys and email credentials:
   ```bash
   # Required: Anthropic Claude API
   CLAUDE_API_KEY=sk-ant-your-actual-api-key-here

   # Required: Email Configuration
   EMAIL_SERVER=imap.gmail.com
   EMAIL_USERNAME=your-newsletters@gmail.com
   EMAIL_PASSWORD=your-gmail-app-password-here
   EMAIL_FOLDER=INBOX

   # Required: SMTP for notifications
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   NOTIFICATION_EMAIL=your-main@gmail.com

   # Optional: Link enrichment
   LINKPREVIEW_API_KEY=your-linkpreview-key-here

   # Optional: Obsidian Integration
   OBSIDIAN_VAULT_PATH=/Users/yourusername/Documents/Obsidian Vault
   OBSIDIAN_SUMMARIES_FOLDER=Newsletter Summaries
   ```

4. **Start the application**
   ```bash
   make dev
   ```
   
   The application will start with hot-reload enabled:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

5. **Complete setup wizard**
   
   Open http://localhost:3000 in your browser and follow the setup wizard to:
   - Verify your API keys
   - Configure email sources
   - Add RSS feeds (optional)
   - Set up Obsidian integration (optional)

---

## 📖 Detailed Setup Guide

### Gmail Configuration

For best results, create a dedicated Gmail account for newsletters:

1. **Create Gmail Account** (or use existing)
2. **Enable 2-Factor Authentication**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

3. **Generate App Password**
   - Go to Security → 2-Step Verification → App passwords
   - Select "Mail" as the app
   - Select "Other" as the device
   - Name it "Research Automation"
   - Copy the generated 16-character password

4. **Use App Password in .env**
   ```bash
   EMAIL_PASSWORD=your-16-char-app-password
   ```

### Anthropic API Setup

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)
6. Add to `.env`:
   ```bash
   CLAUDE_API_KEY=sk-ant-your-actual-key-here
   ```

### Obsidian Integration (Optional)

1. **Find your Obsidian vault path**
   - Mac: Usually `/Users/yourusername/Documents/Obsidian Vault`
   - Windows: Usually `C:\Users\yourusername\Documents\Obsidian Vault`
   - Linux: Usually `/home/yourusername/Documents/Obsidian Vault`

2. **Update docker-compose.dev.yml**
   
   Edit the backend volumes section:
   ```yaml
   volumes:
     # ... other volumes ...
     - "/your/actual/path/to/Obsidian Vault:/app/obsidian_vault"
   ```

3. **Update .env**
   ```bash
   OBSIDIAN_VAULT_PATH=/app/obsidian_vault
   OBSIDIAN_SUMMARIES_FOLDER=Newsletter Summaries
   ```

4. **Restart the application**
   ```bash
   docker compose -f docker-compose.dev.yml down
   docker compose -f docker-compose.dev.yml up -d
   ```

---

## 🎯 How to Use

### 1. Configure Your Sources

After completing the setup wizard, add your content sources:

**Email Sources:**
- The app automatically monitors your configured Gmail inbox
- It processes unread emails from your selected folder
- Supports forwarded newsletters and direct subscriptions

**RSS Feeds (Podcasts):**
1. Go to Settings → Content Sources
2. Click "Add Source" → Select "RSS Feed"
3. Enter feed name and RSS URL
4. Configure number of episodes to fetch
5. Test the connection
6. Click "Save"

**Web Articles:**
1. Go to Settings → Content Sources
2. Click "Add Source" → Select "Web Scraper"
3. Configure URL patterns to monitor
4. Set up scraping rules
5. Test and save

### 2. Run Processing

**Manual Processing:**
1. Go to Dashboard
2. Click "Start Processing"
3. Watch real-time progress updates
4. View results when complete

**What Happens During Processing:**
1. **Fetch Content** - Retrieves new emails, RSS episodes, and web articles
2. **Extract Links** - Identifies and catalogs all links in content
3. **AI Summarization** - Generates detailed summaries using Claude
4. **Extract Insights** - Pulls out key facts, figures, and strategic insights
5. **Store Data** - Saves everything to local SQLite database
6. **Generate Exports** - Creates markdown files and JSON exports
7. **Weekly Summary** - Auto-generates weekly summary if conditions are met

### 3. Review Your Summaries

**View Individual Summaries:**
- Go to Summaries tab
- Browse by date, source, or search
- Click any summary to see full details
- Download as markdown

**Generate Weekly Summary:**
- Summaries page → "Generate Weekly Summary"
- Or let it auto-generate during processing (configurable)
- Automatically exported to Obsidian if configured

### 4. Explore Your Knowledge Base

**Links Library:**
- Browse all extracted links
- Filter by source, date, or enrichment status
- Mark links as visited
- Search by title or description

**Insights:**
- View extracted key insights
- Filter by topic or source
- Search across all insights

---

## ⚙️ Configuration

### Processing Settings

Configure how content is processed:

```bash
# Processing
MAX_ARTICLES_PER_RUN=20
ENABLE_LINK_ENRICHMENT=true
MAX_LINKS_TO_ENRICH=10
CLAUDE_MODEL=claude-sonnet-4-5

# Weekly Summaries
AUTO_GENERATE_WEEKLY_SUMMARY=true
WEEKLY_SUMMARY_MIN_DAYS=3
```

### Data Storage

All data is stored locally in the `./data` directory:

```
data/
├── database/
│   └── insights.db          # SQLite database
├── exports/                 # Generated exports
├── logs/                    # Application logs
└── cache/                   # Temporary files
```

### Customization

**Adjust AI Summary Quality:**
- Settings → Processing → Claude Model
- Options: `claude-sonnet-4-5`, `claude-opus-4-1`

**Link Enrichment:**
- Settings → Processing → Enable Link Enrichment
- Fetches previews, titles, descriptions for links
- Requires LinkPreview API key

**Weekly Summary Timing:**
- Settings → Processing → Weekly Summary Settings
- Auto-generate: Enable/disable automatic generation
- Min days: Minimum days between auto-generation (1-14)

---

## 🛠️ Development Commands

The project includes a comprehensive Makefile for common tasks:

```bash
# Setup & Start
make setup              # Initial setup - creates .env
make dev                # Start development environment
make dev-detached       # Start in background

# Monitoring
make logs               # Show all logs
make logs-backend       # Show backend logs only
make logs-frontend      # Show frontend logs only
make status             # Show current status

# Database
make db-shell           # Access SQLite database
make db-backup          # Backup database

# Debugging
make shell-backend      # Get bash shell in backend
make shell-frontend     # Get shell in frontend
make check              # Verify installation

# Maintenance
make backup             # Backup all data
make clean              # Stop and remove containers
make reset-data         # Reset all data (destructive!)
```

---

## 📊 Architecture

### Technology Stack

**Backend:**
- Python 3.11+
- FastAPI (async web framework)
- SQLite (local database)
- aiosqlite (async database operations)
- Anthropic Claude API (AI summarization)

**Frontend:**
- React 18
- TypeScript 5.2+
- Mantine UI v7
- Zustand (state management)
- Vite (build tool)

**Infrastructure:**
- Docker & Docker Compose
- Multi-stage builds
- Hot-reload development
- Volume mounts for data persistence

### Project Structure

```
research-automation/
├── backend/
│   ├── src/
│   │   ├── core/              # Core engine & config
│   │   ├── processing/        # AI & content processing
│   │   ├── sources/           # Email, RSS, web clients
│   │   ├── storage/           # Database & exports
│   │   └── web/               # FastAPI routes
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Helper functions
│   └── Dockerfile
├── data/                      # Local data (gitignored)
├── docker-compose.dev.yml     # Development config
├── .env.example               # Environment template
├── Makefile                   # Development commands
└── README.md
```

---

## 🔧 Troubleshooting

### Common Issues

**1. Email Connection Fails**
```
Error: Login failed / Invalid credentials
```
**Solution:**
- Ensure you're using an App Password, not your regular Gmail password
- Verify 2FA is enabled on your Google account
- Check EMAIL_USERNAME and EMAIL_PASSWORD in .env

**2. Claude API Errors**
```
Error: Invalid API key
```
**Solution:**
- Verify your API key starts with `sk-ant-`
- Check you have credits in your Anthropic account
- Ensure key is correctly set in .env (no quotes or extra spaces)

**3. Docker Permission Errors**
```
Error: Permission denied accessing data/
```
**Solution:**
```bash
sudo chown -R $USER:$USER ./data
```

**4. Obsidian Export Not Working**
```
Error: Unable to write to Obsidian vault
```
**Solution:**
- Verify the vault path in docker-compose.dev.yml matches your actual vault
- Check the path uses absolute paths (not ~/)
- Restart containers after changing volume mounts:
  ```bash
  docker compose -f docker-compose.dev.yml down
  docker compose -f docker-compose.dev.yml up -d
  ```

**5. Frontend Not Loading**
```
Cannot GET /
```
**Solution:**
- Check frontend is running: `docker compose logs frontend`
- Verify port 3000 is not in use by another application
- Try rebuilding: `docker compose up --build frontend`

**6. Database Locked Errors**
```
Error: database is locked
```
**Solution:**
```bash
# Stop all containers
docker compose down

# Backup and reset database
make db-backup
rm data/database/insights.db

# Restart
make dev
```

### Getting Help

- Check application logs: `make logs`
- Review backend logs: `make logs-backend`
- Check database status: `make db-shell`
- Verify configuration: `make check`
- View full status: `make status`

---

## 📈 Performance & Limits

### Processing Times

Typical processing times for a single run:

- **Email Fetching**: 1-5 seconds
- **RSS Feed Processing**: 2-10 seconds per feed
- **AI Summarization**: 3-5 seconds per article
- **Link Enrichment**: 1-2 seconds per link
- **Weekly Summary**: 10-20 seconds

**Total**: ~5-10 minutes for 20 articles

### Resource Usage

- **Memory**: ~500MB-1GB during processing
- **CPU**: Moderate during AI calls, minimal otherwise
- **Storage**: ~10-50MB per 100 summaries
- **Network**: Depends on content volume

### Rate Limits

- **Anthropic API**: Per your plan (usually 50-100 req/min)
- **Gmail IMAP**: ~100 req/hour recommended
- **LinkPreview API**: Per your plan

---

## 🔐 Security & Privacy

### Data Privacy

- ✅ All data stored locally on your machine
- ✅ No cloud services required (except AI API)
- ✅ No telemetry or analytics
- ✅ API keys never logged or transmitted
- ✅ Emails processed locally only

### Best Practices

1. **Use dedicated email account** for newsletters
2. **Keep .env file secure** - never commit to git
3. **Regular backups**: `make backup`
4. **Rotate API keys** periodically
5. **Review permissions** on data/ directory

### What's Shared

**With Anthropic:**
- Article content for summarization only
- No personal identifying information
- Content processed server-side per their privacy policy

**With LinkPreview (if enabled):**
- URLs for preview generation only
- No personal data sent

---

## 🚀 Roadmap

### Completed ✅
- Core processing engine
- Email, RSS, and web source support
- AI-powered summarization
- Weekly summary generation
- Obsidian integration
- Modern web interface
- Real-time processing updates
- Database schema with full normalization

### Planned Features 🔮
- [ ] Mobile responsive design improvements
- [ ] Export to additional formats (PDF, EPUB)
- [ ] Advanced search with full-text indexing
- [ ] Tag management and organization
- [ ] Processing automation/scheduling
- [ ] Multi-user support
- [ ] Cloud deployment option
- [ ] Browser extension for easy article capture
- [ ] Enhanced analytics dashboard

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- **Python**: Black + isort + flake8
- **TypeScript**: ESLint + Prettier
- **Commits**: Conventional commits format

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Built with [Claude](https://www.anthropic.com/claude) AI by Anthropic
- UI components from [Mantine](https://mantine.dev/)
- Icons from [Tabler Icons](https://tabler.io/icons)
- Inspired by personal knowledge management tools

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/randaldrew/research-automation/issues)
- **Discussions**: [GitHub Discussions](https://github.com/randaldrew/research-automation/discussions)

---

<div align="center">


[⭐ Star on GitHub](https://github.com/randaldrew/research-automation) • [🐛 Report Bug](https://github.com/randaldrew/research-automation/issues) • [✨ Request Feature](https://github.com/randaldrew/research-automation/issues)

</div>