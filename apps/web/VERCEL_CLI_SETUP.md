# Vercel CLI Setup pro sqlpet-web

## 1️⃣ Login (pokud ještě nejsi přihlášený)

```bash
cd apps/web
vercel login
```

Otevře se prohlížeč → přihlaš se do Vercelu.

---

## 2️⃣ Link projekt (vytvoří nový projekt na Vercelu)

```bash
vercel
```

Zodpověz otázky:
```
? Set up and deploy "~/Projects/sqlpet/apps/web"? → Y
? Which scope? → pavels-projects-8a0f92e7 (tvůj team)
? Link to existing project? → N
? What's your project's name? → sqlpet-web
? In which directory is your code located? → ./
```

---

## 3️⃣ Nastav Environment Variables

```bash
# Production
vercel env add NEXT_PUBLIC_API_URL production
# Zadej: https://joyful-elegance.up.railway.app

# Preview (pro git branches)
vercel env add NEXT_PUBLIC_API_URL preview
# Zadej: https://joyful-elegance.up.railway.app

# Development (lokální)
vercel env add NEXT_PUBLIC_API_URL development
# Zadej: http://localhost:8000
```

Nebo použij GUI:
```bash
vercel env pull  # Stáhne .env.local z Vercelu
```

---

## 4️⃣ Deploy

```bash
# Production deploy
vercel --prod

# Nebo automaticky při git push (doporučuji)
git push origin main
# Vercel automaticky detekuje push a deploynout
```

---

## 📁 Výsledek

Po setupu budeš mít:

```
apps/web/
├── .vercel/
│   ├── project.json      # projectId, orgId
│   └── README.txt
├── .env.local            # Local env vars
└── VERCEL_CLI_SETUP.md   # Tento soubor
```

---

## 🚀 Deployment Workflow (jako ve Webomatu)

### Automatický Deploy (doporučeno)

```bash
# 1. Udělej změny v kódu
# 2. Commit
git add .
git commit -m "feat: add new feature"

# 3. Push
git push origin main

# 4. Vercel automaticky deploynout (2-3 min)
# 5. Dostaneš notifikaci v Vercel dashboardu
```

### Manuální Deploy

```bash
cd apps/web
vercel --prod
```

---

## ✅ Verify Deployment

```bash
# Check production URL
curl -s -o /dev/null -w "%{http_code}" https://sqlpet-web.vercel.app
# Očekáváno: 200

# Test login page
curl -s https://sqlpet-web.vercel.app/cs/login | grep "Přihlášení"
```

---

## 🐛 Troubleshooting

### "No existing credentials"
→ Spusť `vercel login` a přihlaš se

### "Project not found"
→ Smaž `.vercel/` folder a spusť `vercel` znovu

### Build fails on Vercel
→ Zkontroluj že `npm run build` projde lokálně
→ Ověř environment variables na Vercelu

### CORS errors po deployi
→ Přidej Vercel URL do Railway backend CORS
→ V `apps/api/src/app/main.py` přidej do `allow_origins`

---

## 📋 Quick Commands

```bash
# Login
vercel login

# Deploy production
vercel --prod

# Deploy preview
vercel

# List deployments
vercel ls

# Check logs
vercel logs

# Open dashboard
vercel dashboard

# Environment variables
vercel env ls
vercel env add VARIABLE_NAME production
vercel env pull
```

---

## 🔗 Užitečné Linky

- Vercel Dashboard: https://vercel.com/pavels-projects-8a0f92e7
- Project Settings: https://vercel.com/pavels-projects-8a0f92e7/sqlpet-web/settings
- Deployments: https://vercel.com/pavels-projects-8a0f92e7/sqlpet-web/deployments
- Railway Backend: https://railway.app/project/37de0081-ad49-4098-a7a1-e29a99745edb
