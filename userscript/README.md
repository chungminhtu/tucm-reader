# Userscript Tampermonkey — TUCM Reader (X)

Userscript cho điện thoại / Edge mobile: lưới masonry, số cột theo thiết bị, phông chữ, và ẩn quảng cáo trên x.com.

## Build

Từ gốc repo:

```
python3 userscript/build.py
```

Ra file: `userscript/dist/x-masonry.user.js` (ghép `public/x-adblock.js` + shim + `src/content/x.css` + `public/x-masonry.js` + panel, không sửa nội dung file dùng chung).

## Kiểm thử

```
node test/run-masonry-mobile.mjs
node test/run-masonry-devices.mjs
```

## Cài đặt

- NetBird: http://minhtu-m5max-64gb.netbird.selfhosted:7445/x-masonry.user.js
- LAN: http://192.168.8.180:7446/x-masonry.user.js
