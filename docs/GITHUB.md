# GitHub push commands

```bash
cd C:/Users/pkg/Downloads/OpusSolutions
git status
git init
git add .
git commit -m "Complete Opus Solutions SaaS migration"
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/developer-sh8e7/ticketbot.git
git push -u origin main --force
```
