import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, Image, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStockLots, StockLot, createWriteoff } from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

const fmt     = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

interface ProductGroup {
  product_id:      number;
  product_name:    string;
  product_image:   string | null;
  lots:            StockLot[];
  total_qty:       number;
  total_value:     number;
  total_investment: number;
}

const REASON_LABELS: Record<string, string> = {
  wrong_entry: 'Lançamento errado',
  combo:       'Baixa para combo',
  other:       'Outro',
};

const REASONS = Object.entries(REASON_LABELS).map(([key, label]) => ({ key, label }));

function groupLots(lots: StockLot[]): ProductGroup[] {
  const map = new Map<number, ProductGroup>();
  for (const lot of lots) {
    if (!map.has(lot.product_id)) {
      map.set(lot.product_id, {
        product_id: lot.product_id, product_name: lot.product_name,
        product_image: lot.product_image, lots: [],
        total_qty: 0, total_value: 0, total_investment: 0,
      });
    }
    const g = map.get(lot.product_id)!;
    g.lots.push(lot);
    g.total_qty        += lot.remaining_quantity;
    g.total_value      += lot.sale_price * lot.remaining_quantity;
    g.total_investment += lot.purchase_price * lot.remaining_quantity;
  }
  return Array.from(map.values());
}

export default function EstoqueScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [groups, setGroups]   = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [writeoffModal, setWriteoffModal]   = useState(false);
  const [writeoffLot,   setWriteoffLot]     = useState<StockLot | null>(null);
  const [writeoffQty,   setWriteoffQty]     = useState('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const [writeoffJustif, setWriteoffJustif] = useState('');
  const [savingWriteoff, setSavingWriteoff] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setGroups(groupLots(await getStockLots())); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  const totalValue      = groups.reduce((s, g) => s + g.total_value, 0);
  const totalInvestment = groups.reduce((s, g) => s + g.total_investment, 0);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => String(g.product_id)}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            groups.length > 0 ? (
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
            ) : null
          }
          renderItem={({ item: g }) => (
            <View style={s.productCard}>
              <View style={s.productHeader}>
                {g.product_image ? (
                  <Image source={{ uri: g.product_image }} style={s.img} />
                ) : (
                  <View style={[s.img, s.imgPlaceholder]}>
                    <Ionicons name="wine-outline" size={20} color={t.border} />
                  </View>
                )}
                <View style={s.productHeaderInfo}>
                  <Text style={s.productName}>{g.product_name}</Text>
                  <Text style={s.productTotals}>
                    {g.total_qty} un · Investido {fmt(g.total_investment)} · Venda {fmt(g.total_value)}
                  </Text>
                </View>
              </View>

              {g.lots.map((lot, i) => (
                <View key={lot.entry_id} style={[s.lot, i === 0 && s.lotFirst]}>
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
                  <View style={s.lotPrices}>
                    <View style={s.priceCol}>
                      <Text style={s.priceLabel}>Compra</Text>
                      <Text style={s.priceVal}>{fmt(lot.purchase_price)}</Text>
                    </View>
                    <View style={s.priceCol}>
                      <Text style={s.priceLabel}>Margem</Text>
                      <Text style={s.priceVal}>{lot.margin_pct.toFixed(1)}%</Text>
                    </View>
                    <View style={s.priceCol}>
                      <Text style={s.priceLabel}>Venda</Text>
                      <Text style={[s.priceVal, s.priceGold]}>{fmt(lot.sale_price)}</Text>
                    </View>
                    <View style={s.priceCol}>
                      <Text style={s.priceLabel}>Val. lote</Text>
                      <Text style={[s.priceVal, s.priceGold]}>
                        {fmt(lot.sale_price * lot.remaining_quantity)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="bar-chart-outline" size={64} color={t.border} />
              <Text style={s.emptyText}>Estoque vazio</Text>
              <Text style={s.emptyHint}>Registre uma entrada primeiro</Text>
            </View>
          }
        />
      )}
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
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: t.bg },
    list:       { padding: 12 },
    summary: {
      backgroundColor: '#0A0A0A', borderRadius: 12, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: GOLD,
    },
    summaryRow:        { flexDirection: 'row', marginBottom: 10 },
    summaryCol:        { flex: 1, alignItems: 'center' },
    summaryDivider:    { width: 1, backgroundColor: 'rgba(201,168,76,0.3)' },
    summaryLabel:      { color: 'rgba(201,168,76,0.7)', fontSize: 11, marginBottom: 4 },
    summaryValueSmall: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    profitRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderTopWidth: 1, borderTopColor: 'rgba(201,168,76,0.2)', paddingTop: 10,
    },
    profitLabel: { color: 'rgba(201,168,76,0.7)', fontSize: 12 },
    profitValue: { color: GOLD, fontSize: 18, fontWeight: 'bold' },
    productCard: {
      backgroundColor: t.card, borderRadius: 12, marginBottom: 12,
      borderWidth: 1, borderColor: t.border, overflow: 'hidden',
    },
    productHeader: {
      flexDirection: 'row', alignItems: 'center',
      padding: 12, borderBottomWidth: 1, borderBottomColor: t.border,
    },
    img:           { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
    imgPlaceholder:{ backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    productHeaderInfo: { flex: 1 },
    productName:   { fontSize: 15, fontWeight: '700', color: t.text },
    productTotals: { fontSize: 11, color: GOLD, fontWeight: '600', marginTop: 2 },
    lot:           { padding: 12, borderTopWidth: 1, borderTopColor: t.border },
    lotFirst:      { borderTopWidth: 0 },
    lotHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    lotBadge: {
      backgroundColor: t.badge, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: t.border,
    },
    lotBadgeText:  { fontSize: 11, color: t.sub, fontWeight: '600' },
    lotQty:        { fontSize: 13, fontWeight: '700', color: t.text },
    lotPrices:     { flexDirection: 'row' },
    priceCol:      { flex: 1, alignItems: 'center' },
    priceLabel:    { fontSize: 10, color: t.sub, marginBottom: 2 },
    priceVal:      { fontSize: 12, fontWeight: '600', color: t.text },
    priceGold:     { color: GOLD },
    empty:         { alignItems: 'center', marginTop: 80, gap: 8 },
    emptyText:     { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint:     { fontSize: 13, color: t.placeholder },
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
  });
}
