# Deploy

VPS Contabo, Docker Compose ต่อโปรเจกต์, Caddy รันบนโฮสต์

## ครั้งแรก

1. `cp .env.example .env` แล้วเติมค่าให้ครบ
   ```sh
   openssl rand -hex 32   # ENCRYPTION_KEY
   openssl rand -hex 32   # SESSION_SECRET
   openssl rand -hex 16   # SIGNUP_INVITE_CODE
   chmod 600 .env
   ```
   **`ENCRYPTION_KEY` หายคือถอด refresh token และรหัสผ่าน PDF เก่าไม่ได้อีกเลย**
   เก็บสำเนาไว้ใน password manager นอกเครื่องด้วย ห้ามอยู่แต่ในไฟล์นี้ไฟล์เดียว

2. Google Cloud Console → สร้าง OAuth 2.0 Client ID แบบ Web application
   - Authorized redirect URI: `https://<โดเมน>/auth/google/callback`
   - scope ที่ขอ: `openid email profile gmail.readonly`
   - **ห้ามเพิ่ม scope `drive`** ลงในไคลเอนต์ตัวนี้ (สำรองข้อมูลใช้ credential คนละตัว)

3. เพิ่มบล็อกใน `Caddyfile` ของโฮสต์ (ดูไฟล์ `Caddyfile` ในรีโปเป็นตัวอย่าง) แล้ว `caddy reload`

4. เตรียมโฟลเดอร์เก็บ PDF **ก่อน** `up` ครั้งแรก

   ```sh
   mkdir -p data/pdf && sudo chown 1000:1000 data/pdf
   ```

   ถ้าไม่ทำ Docker จะสร้างให้เองเป็น `root:root` แล้ว process ในคอนเทนเนอร์ (uid 1000 `node`) เขียนไม่ได้
   บน Docker Desktop/Windows จะไม่เจอปัญหานี้เพราะ filesystem layer แกล้งบอกว่าเขียนได้ — เจอเฉพาะบน Linux จริง

5. `docker compose up -d --build` — migration รันเองตอนแอปบูต

6. ล็อกอินด้วยอีเมลที่ตั้งไว้ใน `ADMIN_EMAIL` พร้อมรหัสเชิญ → ได้สิทธิ์แอดมิน + อนุมัติอัตโนมัติ
   คนอื่นล็อกอินได้แต่จะเป็น `pending` จนแอดมินกดอนุมัติ

## อัปเดต

```sh
git pull && docker compose up -d --build
```

## ข้อควรระวัง

- `db` ไม่ publish port โดยตั้งใจ ถ้าจะต่อดูข้อมูล ใช้ `docker compose exec db psql -U ledger ledger`
- `app` publish ที่ `127.0.0.1:3001` เท่านั้น กฎ iptables ของ Docker **ข้าม UFW** ถ้าเผลอเขียนเป็น `3001:3000` เฉย ๆ เท่ากับเปิดพอร์ตสู่อินเทอร์เน็ต
- สำรองข้อมูล: `pg_dump` → **เข้ารหัสก่อนอัปโหลด** ผ่าน `rclone crypt` remote และใช้ credential ของ rclone แยกจากแอป (คนละบัญชี Google ยิ่งดี)
- `data/pdf/` เก็บ PDF ต้นฉบับที่**ยังเข้ารหัสอยู่** ไฟล์ที่ถอดรหัสแล้วไม่เคยลงดิสก์

## ตรวจว่าเครื่องมือใน image ครบ

```sh
docker compose exec app qpdf --version      # ต้อง >= 10.2 (ยืนยันแล้ว 2026-08-27: bookworm ให้ 11.3.0)
docker compose exec app pdftotext -v
```
