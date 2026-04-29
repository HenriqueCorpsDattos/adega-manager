# Design: Baixas Excepcionais de Estoque

**Data:** 2026-04-29
**Arquivos afetados:** `src/database/db.ts`, `app/(tabs)/estoque.tsx`

---

## Objetivo

Permitir que o usuário dê baixa em itens de estoque por motivos não-comerciais (lançamento errado, consumo em combo, outros), com registro de motivo e justificativa. As baixas excepcionais têm histórico próprio e **não impactam os relatórios financeiros**.

---

## Banco de Dados

### Nova tabela: `stock_writeoffs`

```sql
CREATE TABLE IF NOT EXISTS stock_writeoffs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id      INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  quantity      REAL    NOT NULL,
  reason_type   TEXT    NOT NULL,  -- 'wrong_entry' | 'combo' | 'other'
  justification TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (entry_id)   REFERENCES stock_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)      ON DELETE CASCADE
);
```

### Regras de negócio
- `reason_type` aceita exatamente três valores: `'wrong_entry'` (Lançamento errado), `'combo'` (Baixa para combo), `'other'` (Outro)
- `justification` é **obrigatório** quando `reason_type = 'other'`, opcional nos demais
- `quantity` deve ser > 0 e ≤ quantidade restante do lote no momento da baixa

### Atualização do cálculo de quantidade restante

As queries que calculam `remaining_quantity` em `getStockLots()` e `getStockSummary()` passam a subtrair também os write-offs:

```sql
se.quantity
  - COALESCE((SELECT SUM(oi.quantity) FROM order_items    oi WHERE oi.entry_id = se.id), 0)
  - COALESCE((SELECT SUM(sw.quantity) FROM stock_writeoffs sw WHERE sw.entry_id = se.id), 0)
AS remaining_quantity
```

### Novas funções em `db.ts`

```ts
// Registra uma baixa excepcional
createWriteoff(entryId: number, productId: number, quantity: number, reasonType: string, justification: string | null): Promise<void>

// Retorna histórico completo, ordenado por data desc
getWriteoffs(): Promise<Writeoff[]>
```

Novo tipo exportado:
```ts
export interface Writeoff {
  id:            number;
  entry_id:      number;
  product_id:    number;
  product_name:  string;
  product_image: string | null;
  quantity:      number;
  reason_type:   string;
  justification: string | null;
  entry_date:    string;   // data do lote (de stock_entries)
  created_at:    string;   // data da baixa
}
```

Migration segura adicionada ao array de migrations existente (idempotente com `CREATE TABLE IF NOT EXISTS`).

---

## UI — Tela de Estoque (`estoque.tsx`)

### 1. Botão no card de lote

Cada card de lote recebe um ícone `alert-circle-outline` (Ionicons) no canto superior direito. Ao tocar, abre o modal de baixa excepcional para aquele lote.

### 2. Modal de baixa excepcional

Bottom-sheet com:

| Campo | Detalhe |
|---|---|
| Cabeçalho | Nome do produto + data do lote |
| Quantidade | `TextInput` numérico; placeholder = quantidade restante; valida 0 < qty ≤ restante |
| Motivo | 3 botões de seleção (apenas um ativo por vez): "Lançamento errado" / "Baixa para combo" / "Outro" |
| Justificativa | `TextInput` multilinha; obrigatório quando motivo = "Outro", opcional nos demais |
| Confirmar Baixa | Botão vermelho/danger; desabilitado se validações falharem |

Ao confirmar:
1. Chama `createWriteoff(...)`
2. Fecha o modal
3. Recarrega os lotes (`load()`)

### 3. Botão "Histórico de Baixas" na tela de Estoque

Botão no cabeçalho da tela (ícone `time-outline` ou texto "Histórico"). Ao tocar, abre modal de histórico.

### 4. Modal de histórico

Lista de todas as baixas excepcionais ordenadas por data (mais recente primeiro). Cada item exibe:
- Imagem/ícone do produto
- Nome do produto
- Data do lote + data da baixa
- Quantidade baixada
- Motivo (label legível: "Lançamento errado" / "Baixa para combo" / "Outro")
- Justificativa (se preenchida)

Estado vazio: ícone + "Nenhuma baixa excepcional registrada".
