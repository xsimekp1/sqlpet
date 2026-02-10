# Railway Environment Variables - sqlpet backend

## 📋 Přesné hodnoty pro Railway projekt: joyful-elegance

Railway Dashboard: https://railway.app/project/37de0081-ad49-4098-a7a1-e29a99745edb

### Jak nastavit:
1. Otevři Railway projekt výše
2. Klikni na backend service
3. Variables tab
4. Zkopíruj a vlož každou proměnnou níže
5. Klikni Deploy (nebo počkej na auto-redeploy)

---

## Required Environment Variables

```env
# Database - Supabase PostgreSQL
DATABASE_URL_ASYNC=postgresql+asyncpg://postgres.ieubksumlsvsdsvqbalh:Malinva2026%2B@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?ssl=require

DATABASE_URL_SYNC=postgresql+psycopg://postgres.ieubksumlsvsdsvqbalh:Malinva2026%2B@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require

# JWT Authentication
JWT_SECRET=3-c9_zJLZG48Cidv6Y2DwYANeOww6C9yS7ndWNfCO9M
JWT_ISSUER=sqlpet
JWT_ACCESS_TTL_MIN=15
JWT_REFRESH_TTL_DAYS=30

# Application Config
APP_NAME=SQLpet API
ENV=production
```

---

## ✅ Checklist

Po nastavení ověř:

- [ ] Všechny proměnné jsou nastavené na Railway
- [ ] Railway se automaticky redeployuje
- [ ] Build projde (sleduj logy)
- [ ] Backend je dostupný na: https://joyful-elegance.up.railway.app
- [ ] Health check funguje: `curl https://joyful-elegance.up.railway.app/health/db`

---

## 🔒 Security Notes

- `JWT_SECRET` je vygenerovaný náhodný string pro production
- Database credentials obsahují heslo `Malinva2026+` (URL-encoded jako `Malinva2026%2B`)
- `DATABASE_URL_ASYNC` používá `asyncpg` driver pro async operace
- `DATABASE_URL_SYNC` používá `psycopg` driver pro sync operace (Alembic migrations)

---

## 🐛 Troubleshooting

### Error: "DATABASE_URL_ASYNC field required"
✅ **Řešeno**: Přidej všechny proměnné výše na Railway

### Build fails na "pip install"
✅ **Řešeno**: Dockerfile je správně nakonfigurovaný v posledním commitu

### Error: "Connection refused"
- Zkontroluj, že Supabase database běží
- Ověř connection string (heslo má %2B místo +)

### Health check fails
```bash
# Test health check
curl https://joyful-elegance.up.railway.app/health/db

# Očekávaný response:
{"status":"healthy","database":"connected"}
```

---

## 📝 Quick Copy (pro Railway Variables tab)

Zkopíruj každý řádek do Railway Variables:

```
DATABASE_URL_ASYNC = postgresql+asyncpg://postgres.ieubksumlsvsdsvqbalh:Malinva2026%2B@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?ssl=require
DATABASE_URL_SYNC = postgresql+psycopg://postgres.ieubksumlsvsdsvqbalh:Malinva2026%2B@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
JWT_SECRET = 3-c9_zJLZG48Cidv6Y2DwYANeOww6C9yS7ndWNfCO9M
JWT_ISSUER = sqlpet
JWT_ACCESS_TTL_MIN = 15
JWT_REFRESH_TTL_DAYS = 30
APP_NAME = SQLpet API
ENV = production
```
