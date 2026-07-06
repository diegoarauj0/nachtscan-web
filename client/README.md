# Nachtscan Client

## Environment Variables

Copie o arquivo `.env.example` para `.env` e ajuste os valores:

```bash
cp .env.example .env
```

| Variável  | Descrição                    | Padrão                  |
|-----------|------------------------------|-------------------------|
| `API_URL` | URL da API do backend        | `http://localhost:3000` |

O arquivo `src/environments/environment.ts` é gerado automaticamente a partir do `.env` antes de cada build/serve. Não edite-o manualmente.

### Modo de produção

```bash
npm run build        # gera environment.ts com production: true
```

### Modo de desenvolvimento

```bash
npm start            # gera environment.ts com production: false e inicia o servidor
```
