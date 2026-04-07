import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStockInfo, StockInfo } from '../../src/database/db';

const WINE = '#722F37';

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function EstoqueScreen() {
  const [stock, setStock]   = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try { setStock(await getStockInfo()); }
      finally { setLoading(false); }
    };
    load();
  }, []));

  // Valor total do estoque (preço de venda × quantidade)
  const totalValue = stock.reduce((sum, item) => {
    if (!item.last_purchase_price || !item.last_margin_pct) return sum;
    const salePrice = item.last_purchase_price * (1 + item.last_margin_pct / 100);
    return sum + salePrice * item.total_quantity;
  }, 0);

  const renderItem = ({ item }: { item: StockInfo }) => {
    const salePrice = item.last_purchase_price != null && item.last_margin_pct != null
      ? item.last_purchase_price * (1 + item.last_margin_pct / 100)
      : null;
    const stockValue = salePrice != null
      ? salePrice * item.total_quantity
      : null;

    return (
      <View style={s.card}>
        {/* Imagem + nome */}
        <View style={s.cardTop}>
          {item.product_image ? (
            <Image source={{ uri: item.product_image }} style={s.img} />
          ) : (
            <View style={[s.img, s.imgPlaceholder]}>
              <Ionicons name="wine-outline" size={24} color="#CCC" />
            </View>
          )}
          <View style={s.cardInfo}>
            <Text style={s.productName}>{item.product_name}</Text>
            <View style={s.stockBadge}>
              <Text style={[s.stockBadgeText, item.total_quantity <= 0 && s.outOfStock]}>
                {item.total_quantity} un em estoque
              </Text>
            </View>
          </View>
        </View>

        {/* Preços */}
        {item.last_purchase_price != null ? (
          <View style={s.priceRow}>
            <View style={s.priceCol}>
              <Text style={s.priceLabel}>Compra</Text>
              <Text style={s.priceValue}>{fmt(item.last_purchase_price)}</Text>
            </View>
            <View style={s.priceCol}>
              <Text style={s.priceLabel}>Margem</Text>
              <Text style={s.priceValue}>{item.last_margin_pct?.toFixed(1)}%</Text>
            </View>
            <View style={s.priceCol}>
              <Text style={s.priceLabel}>Venda</Text>
              <Text style={[s.priceValue, s.priceGreen]}>
                {salePrice != null ? fmt(salePrice) : '—'}
              </Text>
            </View>
            <View style={s.priceCol}>
              <Text style={s.priceLabel}>Val. estoque</Text>
              <Text style={[s.priceValue, s.priceWine]}>
                {stockValue != null ? fmt(stockValue) : '—'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={s.noEntry}>Sem entradas registradas</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading ? (
        <ActivityIndicator size="large" color={WINE} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={stock}
          keyExtractor={item => String(item.product_id)}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            stock.length > 0 ? (
              <View style={s.summary}>
                <Text style={s.summaryLabel}>Valor total em estoque (venda)</Text>
                <Text style={s.summaryValue}>{fmt(totalValue)}</Text>
              </View>
            ) : null
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="bar-chart-outline" size={64} color="#DDD" />
              <Text style={s.emptyText}>Nenhum produto no estoque</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F0EB' },
  list:       { padding: 12 },
  summary: {
    backgroundColor: WINE, borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  summaryValue: { color: '#FFF', fontSize: 26, fontWeight: 'bold', marginTop: 2 },
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 14,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  cardTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  img:        { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  imgPlaceholder: { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  cardInfo:   { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  stockBadge: {
    alignSelf: 'flex-start', backgroundColor: '#F5F0EB',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  stockBadgeText: { fontSize: 12, color: '#555', fontWeight: '600' },
  outOfStock: { color: '#E74C3C' },
  priceRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10 },
  priceCol:   { flex: 1, alignItems: 'center' },
  priceLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  priceValue: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  priceGreen: { color: '#27AE60' },
  priceWine:  { color: WINE },
  noEntry:    { fontSize: 13, color: '#BBB', fontStyle: 'italic' },
  empty:      { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText:  { fontSize: 16, color: '#999', fontWeight: '500' },
});
