# Một bông hoa chỉ tồn tại cho apn

Quà 20/10: bông hồng thủy tinh 3D dựng bằng hình học thủ tục (React + Vite + TypeScript + React Three Fiber + GSAP).

- Sửa lời chúc / chữ hiển thị: `src/config/content.ts`
- Hình dạng bông hoa: `src/rose/RoseParameters.ts` (seed từ nickname "apn")
- Chạy thử: `npm install && npm run dev`
- Build: `npm run build` (ra thư mục `dist`)
- Deploy: Vercel (import repo, mặc định) hoặc GitHub Pages (workflow có sẵn trong `.github/workflows`).
- Debug: `?clay=1` (vật liệu đất sét), `?b=0.5` (khoá mức nở), `?post=0` (tắt hậu kỳ), `?tier=low|medium|high`.
