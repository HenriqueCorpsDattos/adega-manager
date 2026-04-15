import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStockLots, StockLot } from '../../src/database/db';
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

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try { setGroups(groupLots(await getStockLots())); }
      finally { setLoading(false); }
    };
    load();
  }, []));

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
                    <Text style={s.lotQty}>{lot.remaining_quantity} un</Text>
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
  });
}
