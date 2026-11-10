# BLACKOUT PROTOCOL

Shooter en primera persona por oleadas, construido con Three.js. 100% estático: sin build, sin assets externos (texturas y sonidos generados por código). Listo para GitHub Pages.

## Jugar en local

```
python -m http.server 8000
```

y abre http://localhost:8000 (necesita servidor por los módulos ES; no funciona abriendo el archivo directamente).

## Desplegar en GitHub Pages

1. Crea un repositorio en GitHub y sube estos archivos a la rama `main`.
2. En el repo: **Settings → Pages → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. El juego quedará en `https://<tu-usuario>.github.io/<repo>/`.

## Controles

| Tecla | Acción |
|---|---|
| WASD | Moverse |
| Ratón | Apuntar / disparar |
| Click derecho | Mira (ADS) |
| Shift | Correr |
| Espacio | Saltar |
| R | Recargar |
| Esc | Pausa |
