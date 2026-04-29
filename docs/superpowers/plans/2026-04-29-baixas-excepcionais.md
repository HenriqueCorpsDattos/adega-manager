# Baixas Excepcionais de Estoque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário dê baixa em itens de estoque por motivos não-comerciais (lançamento errado, combo, outro), com registro de motivo/justificativa e histórico separado dos relatórios financeiros.

**Architecture:** Nova tabela `stock_writeoffs` armazena as baixas. O cálculo de quantidade restante de cada lote passa a subtrair write-offs além de order_items. A tela de Estoque ganha um botão por lote (modal de baixa) e um botão global (modal de histórico).

**Tech Stack:** React Native 0.74, Expo 51, TypeScript strict, expo-sqlite 14, Ionicons.

---

## File Map

| Arquivo | O que muda |
|---|---|
| `src/database/db.ts` | Nova tabela `stock_writeoffs`, interface `Writeoff`, funções `createWriteoff` e `getWriteoffs`, atualização das queries `getStockLots` e `getStockSummary` |
| `app/(tabs)/estoque.tsx` | Novos imports, refatoração do `load`, botão de baixa por lote + modal, botão de histórico + modal, novos estilos |

---

## Task 1: db.ts — tabela, interface e funções

**Files:**
- Modify: `src/database/db.ts`

- [ ] **Step 1: Adicionar `stock_writeoffs` ao bloco `execAsync` em `getDatabase`**

Localizar o final do bloco `execAsync` (~linha 183–191). A última tabela criada é `shopping_list`. Substituir o fechamento `);` pelo bloco abaixo:

```ts
    CREATE TABLE IF NOT EXISTS stock_writeoffs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id      INTEGER NOT NULL,
      product_id    INTEGER NOT NULL,
      quantity      REAL    NOT NULL,
      reason_type   TEXT    NOT NULL,
      justification TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (entry_id)   REFERENCES stock_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)      ON DELETE CASCADE
    );
  `);
```

*(O `);` anterior da shopping_list permanece — apenas adiciona o novo bloco antes do fechamento do template literal.)*

- [ ] **Step 2: Adicionar interface `Writeoff` após a interface `ReportPeriod`**

Localizar (~linha 87, após `export interface ReportPeriod { ... }`). Inserir:

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
  entry_date:    string;
  created_at:    string;
}
```

- [ ] **Step 3: Adicionar função `createWriteoff` após `registerEntry`**

Localizar (~linha 336, após a função `registerEntry`). Inserir:

```ts
export async function createWriteoff(
  entryId:      number,
  productId:    number,
  quantity:     number,
  reasonType:   string,
  justification: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO stock_writeoffs (entry_id, product_id, quantity, reason_type, justification) VALUES (?, ?, ?, ?, ?)',
    [entryId, productId, quantity, reasonType, justification],
  );
}
```

- [ ] **Step 4: Adicionar função `getWriteoffs` logo após `createWriteoff`**

```ts
export async function getWriteoffs(): Promise<Writeoff[]> {
  const db = await getDatabase();
  return db.getAllAsync<Writeoff>(`
    SELECT
      sw.id,
      sw.entry_id,
      sw.product_id,
      p.name        AS product_name,
      p.image_uri   AS product_image,
      sw.quantity,
      sw.reason_type,
      sw.justification,
      se.entry_date,
      sw.created_at
    FROM stock_writeoffs sw
    JOIN products      p  ON p.id  = sw.product_id
    JOIN stock_entries se ON se.id = sw.entry_id
    ORDER BY sw.created_at DESC
  `);
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd "C:\Users\henrique.franca\Desktop\Teste claudinho\adega-manager"
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/database/db.ts
git commit -m "feat: tabela stock_writeoffs, interface Writeoff e funcoes createWriteoff/getWriteoffs"
```

---

## Task 2: db.ts — atualizar remaining_quantity para subtrair write-offs

**Files:**
- Modify: `src/database/db.ts`

- [ ] **Step 1: Atualizar `getStockLots` — subtrair write-offs do remaining_quantity**

Localizar em `getStockLots` (~linha 284–286):

```ts
      (se.quantity - COALESCE(
        (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.entry_id = se.id), 0
      ))                   AS remaining_quantity,
```

Substituir por:

```ts
      (se.quantity
        - COALESCE((SELECT SUM(oi.quantity) FROM order_items    oi WHERE oi.entry_id = se.id), 0)
        - COALESCE((SELECT SUM(sw.quantity) FROM stock_writeoffs sw WHERE sw.entry_id = se.id), 0)
      )                    AS remaining_quantity,
```

- [ ] **Step 2: Atualizar `getStockSummary` — subtrair write-offs de total_quantity e total_investment**

Localizar em `getStockSummary` (~linha 306–315) o bloco completo dos dois COALESCEs:

```ts
      COALESCE(SUM(
        se.quantity - COALESCE((
          SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.entry_id = se.id
        ), 0)
      ), 0)                                       AS total_quantity,
      COALESCE(SUM(
        (se.quantity - COALESCE((
          SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.entry_id = se.id
        ), 0)) * se.purchase_price
      ), 0)                                       AS total_investment
```

Substituir por:

```ts
      COALESCE(SUM(
        se.quantity
        - COALESCE((SELECT SUM(oi.quantity) FROM order_items    oi WHERE oi.entry_id = se.id), 0)
        - COALESCE((SELECT SUM(sw.quantity) FROM stock_writeoffs sw WHERE sw.entry_id = se.id), 0)
      ), 0)                                       AS total_quantity,
      COALESCE(SUM(
        (se.quantity
          - COALESCE((SELECT SUM(oi.quantity) FROM order_items    oi WHERE oi.entry_id = se.id), 0)
          - COALESCE((SELECT SUM(sw.quantity) FROM stock_writeoffs sw WHERE sw.entry_id = se.id), 0)
        ) * se.purchase_price
      ), 0)                                       AS total_investment
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/database/db.ts
git commit -m "fix: subtrair write-offs do remaining_quantity em getStockLots e getStockSummary"
```

---

## Task 3: estoque.tsx — botão por lote + modal de baixa excepcional

**Files:**
- Modify: `app/(tabs)/estoque.tsx`

- [ ] **Step 1: Expandir imports de react-native**

Localizar (linha 2):
```ts
import { View, Text, FlatList, Image, StyleSheet, ActivityIndicator } from 'react-native';
```

Substituir por:
```ts
import {
  View, Text, FlatList, Image, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Alert,
} from 'react-native';
```

- [ ] **Step 2: Adicionar imports de db.ts**

Localizar (linha 6):
```ts
import { getStockLots, StockLot } from '../../src/database/db';
```

Substituir por:
```ts
import { getStockLots, StockLot, createWriteoff } from '../../src/database/db';
```

- [ ] **Step 3: Adicionar constante REASON_LABELS e array REASONS antes de `groupLots`**

Localizar (~linha 22, antes de `function groupLots`). Inserir:

```ts
const REASON_LABELS: Record<string, string> = {
  wrong_entry: 'Lançamento errado',
  combo:       'Baixa para combo',
  other:       'Outro',
};

const REASONS = Object.entries(REASON_LABELS).map(([key, label]) => ({ key, label }));
```

- [ ] **Step 4: Refatorar `load` em `useCallback` dentro do componente**

No componente `EstoqueScreen`, localizar o bloco atual:
```ts
  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try { setGroups(groupLots(await getStockLots())); }
      finally { setLoading(false); }
    };
    load();
  }, []));
```

Substituir por:
```ts
  const load = useCallback(async () => {
    setLoading(true);
    try { setGroups(groupLots(await getStockLots())); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
```

- [ ] **Step 5: Adicionar estados do modal de baixa excepcional**

Após a linha `const [loading, setLoading] = useState(true);`, inserir:

```ts
  const [writeoffModal, setWriteoffModal]   = useState(false);
  const [writeoffLot,   setWriteoffLot]     = useState<StockLot | null>(null);
  const [writeoffQty,   setWriteoffQty]     = useState('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const [writeoffJustif, setWriteoffJustif] = useState('');
  const [savingWriteoff, setSavingWriteoff] = useState(false);
```

- [ ] **Step 6: Adicionar handlers `openWriteoff` e `handleWriteoff` antes do `return`**

Após os `useCallback` de `load` e `useFocusEffect`, inserir:

```ts
  const openWriteoff = (lot: StockLot) => {
    setWriteoffLot(lot);
    setWriteoffQty('');
    setWriteoffReason('');
    setWriteoffJustif('');
    setWriteoffModal(true);
  };

  const handleWriteoff = async () => {
    if (!writeoffLot) return;
    const qty = parseFloat(writeoffQty);
    if (!qty || qty <= 0 || qty > writeoffLot.remaining_quantity)
      return Alert.alert('Atenção', `Quantidade inválida. Máximo: ${writeoffLot.remaining_quantity} un.`);
    if (!writeoffReason)
      return Alert.alert('Atenção', 'Selecione um motivo.');
    if (writeoffReason === 'other' && !writeoffJustif.trim())
      return Alert.alert('Atenção', 'Justificativa obrigatória para o motivo "Outro".');

    Alert.alert(
      'Confirmar Baixa Excepcional',
      `Baixar ${qty} un do lote ${fmtDate(writeoffLot.entry_date)} — ${writeoffLot.product_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'destructive',
          onPress: async () => {
            setSavingWriteoff(true);
            try {
              await createWriteoff(
                writeoffLot.entry_id,
                writeoffLot.product_id,
                qty,
                writeoffReason,
                writeoffJustif.trim() || null,
              );
              setWriteoffModal(false);
              await load();
            } finally { setSavingWriteoff(false); }
          },
        },
      ],
    );
  };
```

- [ ] **Step 7: Adicionar botão de baixa excepcional no card de lote**

Localizar o `lotHeader` no renderItem (~linha 110):
```tsx
                  <View style={s.lotHeader}>
                    <View style={s.lotBadge}>
                      <Text style={s.lotBadgeText}>Lote {fmtDate(lot.entry_date)}</Text>
                    </View>
                    <Text style={s.lotQty}>{lot.remaining_quantity} un</Text>
                  </View>
```

Substituir por:
```tsx
                  <View style={s.lotHeader}>
                    <View style={s.lotBadge}>
                      <Text style={s.lotBadgeText}>Lote {fmtDate(lot.entry_date)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={s.lotQty}>{lot.remaining_quantity} un</Text>
                      <TouchableOpacity
                        onPress={() => openWriteoff(lot)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="alert-circle-outline" size={18} color={t.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
```

- [ ] **Step 8: Adicionar modal de baixa excepcional antes do `</SafeAreaView>`**

Localizar `</SafeAreaView>` e inserir o modal imediatamente antes:

```tsx
      <Modal visible={writeoffModal} animationType="slide" transparent
        onRequestClose={() => { setWriteoffModal(false); setWriteoffLot(null); }}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Baixa Excepcional</Text>
                {writeoffLot && (
                  <Text style={s.sheetSub}>
                    {writeoffLot.product_name} · Lote {fmtDate(writeoffLot.entry_date)}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => { setWriteoffModal(false); setWriteoffLot(null); }}>
                <Ionicons name="close" size={24} color={t.text} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>
              Quantidade (máx: {writeoffLot?.remaining_quantity ?? 0} un)
            </Text>
            <TextInput
              style={s.fieldInput}
              value={writeoffQty}
              onChangeText={setWriteoffQty}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.placeholder}
            />

            <Text style={[s.fieldLabel, { marginTop: 12 }]}>Motivo</Text>
            <View style={s.reasonRow}>
              {REASONS.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[s.reasonBtn, writeoffReason === r.key && s.reasonBtnActive]}
                  onPress={() => setWriteoffReason(r.key)}
                >
                  <Text style={[s.reasonBtnText, writeoffReason === r.key && s.reasonBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {writeoffReason && (
              <>
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>
                  Justificativa{writeoffReason === 'other' ? ' *' : ' (opcional)'}
                </Text>
                <TextInput
                  style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]}
                  value={writeoffJustif}
                  onChangeText={setWriteoffJustif}
                  placeholder="Descreva o motivo..."
                  placeholderTextColor={t.placeholder}
                  multiline
                />
              </>
            )}

            <TouchableOpacity
              style={[s.confirmBtn, savingWriteoff && { opacity: 0.6 }]}
              onPress={handleWriteoff}
              disabled={savingWriteoff}
            >
              <Text style={s.confirmBtnText}>
                {savingWriteoff ? 'Registrando…' : 'Confirmar Baixa'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
```

- [ ] **Step 9: Adicionar estilos ao `makeStyles`**

Localizar a última chave de `makeStyles` antes do `});` final. Adicionar:

```ts
    overlay:         { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 40,
    },
    sheetHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    sheetTitle:      { fontSize: 17, fontWeight: 'bold', color: t.text },
    sheetSub:        { fontSize: 12, color: t.sub, marginTop: 2 },
    fieldLabel:      { fontSize: 12, color: t.sub, marginBottom: 4, fontWeight: '600' },
    fieldInput: {
      borderWidth: 1, borderColor: t.border, borderRadius: 8, backgroundColor: t.inputBg,
      paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: t.text,
    },
    reasonRow:       { flexDirection: 'row', gap: 6 },
    reasonBtn: {
      flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 8,
      borderWidth: 1, borderColor: t.border, backgroundColor: t.badge, alignItems: 'center',
    },
    reasonBtnActive: { borderColor: t.danger, backgroundColor: 'rgba(220,53,69,0.12)' },
    reasonBtnText:   { fontSize: 11, color: t.sub, fontWeight: '600', textAlign: 'center' },
    reasonBtnTextActive: { color: t.danger },
    confirmBtn:      { backgroundColor: t.danger, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
    confirmBtnText:  { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
```

- [ ] **Step 10: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 11: Commit**

```bash
git add "app/(tabs)/estoque.tsx"
git commit -m "feat: baixa excepcional por lote na tela de estoque"
```

---

## Task 4: estoque.tsx — botão global + modal de histórico de baixas

**Files:**
- Modify: `app/(tabs)/estoque.tsx`

- [ ] **Step 1: Adicionar `getWriteoffs` e `Writeoff` ao import de db.ts**

Localizar:
```ts
import { getStockLots, StockLot, createWriteoff } from '../../src/database/db';
```

Substituir por:
```ts
import { getStockLots, StockLot, createWriteoff, getWriteoffs, Writeoff } from '../../src/database/db';
```

- [ ] **Step 2: Adicionar estados do modal de histórico**

Após os estados do writeoff, inserir:

```ts
  const [historyModal,   setHistoryModal]   = useState(false);
  const [writeoffs,      setWriteoffs]      = useState<Writeoff[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
```

- [ ] **Step 3: Adicionar handler `openHistory`**

Após `handleWriteoff`, inserir:

```ts
  const openHistory = async () => {
    setHistoryLoading(true);
    setHistoryModal(true);
    try { setWriteoffs(await getWriteoffs()); }
    finally { setHistoryLoading(false); }
  };
```

- [ ] **Step 4: Adicionar botão "Histórico" no `ListHeaderComponent`**

Localizar o `ListHeaderComponent` atual:
```tsx
          ListHeaderComponent={
            groups.length > 0 ? (
              <View style={s.summary}>
                ...
              </View>
            ) : null
          }
```

Substituir por:
```tsx
          ListHeaderComponent={
            <View>
              {groups.length > 0 && (
                <View style={s.summary}>
                  <View style={s.summaryRow}>
                    <View style={s.summaryCol}>
                      <Text style={s.summaryLabel}>Investido (custo)</Text>
                      <Text style={s.summaryValueSmall}>{fmt(totalInvestment)}</Text>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryCol}>
                      <Text style={s.summaryLabel}>A receber (venda)</Text>
                      <Text style={[s.summaryValueSmall, { color: GOLD }]}>{fmt(totalValue)}</Text>
                    </View>
                  </View>
                  <View style={s.profitRow}>
                    <Text style={s.profitLabel}>Margem potencial</Text>
                    <Text style={s.profitValue}>{fmt(totalValue - totalInvestment)}</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity style={s.historyBtn} onPress={openHistory}>
                <Ionicons name="time-outline" size={16} color={GOLD} />
                <Text style={s.historyBtnText}>Histórico de Baixas Excepcionais</Text>
                <Ionicons name="chevron-forward" size={16} color={GOLD} />
              </TouchableOpacity>
            </View>
          }
```

- [ ] **Step 5: Adicionar modal de histórico antes de `</SafeAreaView>`**

Adicionar após o modal de writeoff existente:

```tsx
      <Modal visible={historyModal} animationType="slide" transparent
        onRequestClose={() => setHistoryModal(false)}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Histórico de Baixas Excepcionais</Text>
              <TouchableOpacity onPress={() => setHistoryModal(false)}>
                <Ionicons name="close" size={24} color={t.text} />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <ActivityIndicator size="small" color={GOLD} style={{ marginVertical: 24 }} />
            ) : writeoffs.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="checkmark-circle-outline" size={48} color={t.border} />
                <Text style={s.emptyText}>Nenhuma baixa excepcional registrada</Text>
              </View>
            ) : (
              <ScrollView>
                {writeoffs.map(w => (
                  <View key={w.id} style={s.writeoffItem}>
                    {w.product_image ? (
                      <Image source={{ uri: w.product_image }} style={s.writeoffImg} />
                    ) : (
                      <View style={[s.writeoffImg, s.imgPlaceholder]}>
                        <Ionicons name="wine-outline" size={14} color={t.border} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.writeoffName}>{w.product_name}</Text>
                      <Text style={s.writeoffMeta}>
                        Lote {fmtDate(w.entry_date)} · {fmtDate(w.created_at)}
                      </Text>
                      <Text style={s.writeoffReasonLabel}>
                        {REASON_LABELS[w.reason_type] ?? w.reason_type}
                      </Text>
                      {w.justification ? (
                        <Text style={s.writeoffJustifText}>{w.justification}</Text>
                      ) : null}
                    </View>
                    <Text style={s.writeoffQtyText}>-{w.quantity} un</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
```

- [ ] **Step 6: Adicionar estilos de histórico ao `makeStyles`**

Após os estilos adicionados na Task 3, inserir:

```ts
    historyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: t.card, borderRadius: 10, padding: 12,
      marginBottom: 12, borderWidth: 1, borderColor: t.border,
    },
    historyBtnText:       { flex: 1, fontSize: 13, color: GOLD, fontWeight: '600' },
    writeoffItem: {
      flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: t.border, gap: 10,
    },
    writeoffImg:          { width: 36, height: 36, borderRadius: 6 },
    writeoffName:         { fontSize: 13, fontWeight: '600', color: t.text },
    writeoffMeta:         { fontSize: 11, color: t.sub, marginTop: 1 },
    writeoffReasonLabel:  { fontSize: 11, color: t.danger, fontWeight: '600', marginTop: 2 },
    writeoffJustifText:   { fontSize: 11, color: t.placeholder, fontStyle: 'italic', marginTop: 1 },
    writeoffQtyText:      { fontSize: 13, fontWeight: '700', color: t.danger },
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 8: Commit**

```bash
git add "app/(tabs)/estoque.tsx"
git commit -m "feat: historico de baixas excepcionais na tela de estoque"
```
