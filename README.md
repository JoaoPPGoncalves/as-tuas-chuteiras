# As Tuas Chuteiras — catálogo online

Site estático (telemóvel e computador) com o catálogo completo de chuteiras do fornecedor,
traduzido para português, com filtros por **piso, marca, modelo e tamanho**, e encomenda
por mensagem no Instagram [@as_tuas_chuteiras](https://www.instagram.com/as_tuas_chuteiras/).

## Estrutura

```
index.html            página única do site
css/style.css         estilos
js/app.js             filtros, cards, detalhe do produto, botão do Instagram
data/catalog.js       catálogo gerado (não editar à mão)
assets/img/<ref>/     fotos de cada álbum (t.webp = miniatura, 0..4.webp = galeria)
assets/logo.jpg       ← coloca aqui a foto de perfil do Instagram (quadrada)
assets/logo.svg       logótipo provisório (usado se logo.jpg não existir)
scripts/scrape.py     atualiza o catálogo a partir do Yupoo do fornecedor
```

## Atualizar o catálogo

Requisitos (uma vez): `brew install webp`

```bash
python3 scripts/scrape.py
```

- Lê todas as páginas do Yupoo, entra em cada álbum, traduz o título e descarrega até 5 fotos.
- As fotos são copiadas para `assets/img` porque o Yupoo bloqueia imagens mostradas noutros sites.
- Os vídeos são mostrados diretamente do Yupoo (sem som).
- Álbuns que o fornecedor apagou são removidos; fotos já descarregadas não voltam a ser descarregadas.
- `--fresh` volta a ler todos os álbuns (por exemplo, se o fornecedor mudou o stock de tamanhos);
  `--photos 8` guarda mais fotos por álbum.
- A lista com o título original chinês e o link do fornecedor fica só em `.cache/catalog_full.json`
  (não é publicada). A **Ref.** que aparece em cada chuteira é o número do álbum:
  `https://lyzs88.x.yupoo.com/albums/<Ref>`.

## Ver no computador

Basta abrir o `index.html` no browser.

## Publicar

É um site estático, por isso qualquer alojamento grátis serve: Netlify, Cloudflare Pages ou GitHub Pages.
Faz upload da pasta inteira, sem a `.cache/` e sem a `scripts/`.

## Siglas de piso

| Sigla | Piso |
|---|---|
| FG | Relvado natural (seco/firme) |
| SG | Relvado natural molhado/macio (pitons de alumínio) |
| AG | Relvado sintético |
| MG | Multi-piso (natural e sintético) |
| TF | Sintético / turf (pitons pequenos, relva sintética curta, pelado) |
| IC | Futsal / pavilhão (sola lisa) |
