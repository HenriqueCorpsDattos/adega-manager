import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  Modal, StyleSheet, Alert, ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getCurrentPeriod, getOrdersForPeriod, getOrderItems,
  getClosedPeriods, getClosedPeriodsByMonth,
  closePeriod, getOrCreateCurrentPeriod,
  ReportPeriod, Order, OrderItem,
} from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

const fmt         = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate     = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type TabMode = 'current' | 'history' | 'monthly';

export default function RelatorioScreen() {
  const t      = useTheme();
  const s      = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();

  const [mode, setMode]         = useState<TabMode>('current');
  const [period, setPeriod]     = useState<ReportPeriod | null>(null);
  const [orders, setOrders]     = useState<Order[]>([]);
  const [history, setHistory]   = useState<ReportPeriod[]>([]);
  const [loading, setLoading]   = useState(true);
  const [closing, setClosing]   = useState(false);

  // Order detail drill-down
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailModal, setDetailModal] = useState(false);

  // Monthly report
  const [monthInput, setMonthInput] = useState(String(new Date().getMonth() + 1));
  const [yearInput, setYearInput]   = useState(String(new Date().getFullYear()));
  const [monthlyPeriods, setMonthlyPeriods] = useState<ReportPeriod[]>([]);
  const [monthlyLoaded, setMonthlyLoaded]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await getOrCreateCurrentPeriod();
      const [p, hist] = await Promise.all([getCurrentPeriod(), getClosedPeriods()]);
      setPeriod(p);
      setHistory(hist);
      if (p) {
        setOrders(await getOrdersForPeriod(p.id));
      } else {
        setOrders([]);
      }
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const currentTotal   = orders.reduce((s, o) => s + o.total_value, 0);
  const currentNet     = orders.reduce((s, o) => s + o.net_value, 0);
  const currentFee     = orders.reduce((s, o) => s + o.fee_value, 0);

  const handleClose = () => {
    if (!period) return;
    Alert.alert(
      'Fechar Período',
      `Fechar com total bruto de ${fmt(currentTotal)}?\nUm novo período inicia automaticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fechar', style: 'destructive',
          onPress: async () => {
            setClosing(true);
            try { await closePeriod(period.id); await load(); }
            finally { setClosing(false); }
          },
        },
      ],
    );
  };

  const openOrderDetail = async (order: Order) => {
    setDetailOrder(order);
    setDetailItems(await getOrderItems(order.id));
    setDetailModal(true);
  };

  const handleMonthlySearch = async () => {
    const m = parseInt(monthInput);
    const y = parseInt(yearInput);
    if (!m || m < 1 || m > 12 || !y || y < 2000) {
      Alert.alert('Atenção', 'Informe mês (1-12) e ano válidos.'); return;
    }
    const result = await getClosedPeriodsByMonth(y, m);
    setMonthlyPeriods(result);
    setMonthlyLoaded(true);
  };

  const monthlyTotal  = monthlyPeriods.reduce((s, p) => s + (p.total_value ?? 0), 0);
  const monthlyProfit = monthlyPeriods.reduce((s, p) => s + (p.profit ?? 0), 0);

  if (loading) return <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Header tabs */}
      <View style={s.tabBar}>
        {(['current', 'history', 'monthly'] as TabMode[]).map((m, i) => (
          <TouchableOpacity
            key={m}
            style={[s.tabBtn, mode === m && s.tabBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[s.tabBtnText, mode === m && s.tabBtnTextActive]}>
              {['Atual', 'Histórico', 'Mensal'][i]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.pmBtn} onPress={() => router.push('/pagamentos')}>
          <Ionicons name="card-outline" size={20} color={GOLD} />
        </TouchableOpacity>
      </View>

      {/* ── Current period ── */}
      {mode === 'current' && (
        <ScrollView contentContainerStyle={s.list}>
          <View style={s.periodCard}>
            <Text style={s.periodSince}>
              Desde {period ? fmtDate(period.started_at) : '—'} · {orders.length} pedido{orders.length !== 1 ? 's' : ''}
            </Text>
            <View style={s.periodMetrics}>
              <View style={s.metric}>
                <Text style={s.metricLabel}>Bruto</Text>
                <Text style={s.metricVal}>{fmt(currentTotal)}</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricLabel}>Taxas</Text>
                <Text style={[s.metricVal, { color: t.danger }]}>- {fmt(currentFee)}</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricLabel}>Líquido</Text>
                <Text style={[s.metricVal, { color: GOLD }]}>{fmt(currentNet)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.closeBtn, closing && { opacity: 0.6 }]}
              onPress={handleClose}
              disabled={closing}
            >
              <Ionicons name="lock-closed-outline" size={15} color="#000" />
              <Text style={s.closeBtnText}>{closing ? 'Fechando…' : 'Fechar Período'}</Text>
            </TouchableOpacity>
          </View>

          {orders.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={48} color={t.border} />
              <Text style={s.emptyText}>Nenhum pedido neste período</Text>
            </View>
          ) : (
            orders.map(order => (
              <TouchableOpacity key={order.id} style={s.orderCard} onPress={() => openOrderDetail(order)}>
                <View style={s.orderTop}>
                  <View style={s.orderLeft}>
                    <Text style={s.orderDate}>{fmtDateTime(order.created_at)}</Text>
                    <Text style={s.orderMeta}>
                      {order.item_count} item{order.item_count !== 1 ? 's' : ''}
                      {order.payment_method_name ? ` · ${order.payment_method_name}` : ''}
                    </Text>
                  </View>
                  <View style={s.orderRight}>
                    <Text style={s.orderGross}>{fmt(order.total_value)}</Text>
                    {order.fee_value > 0 && (
                      <Text style={s.orderNet}>liq. {fmt(order.net_value)}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.sub} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* ── History ── */}
      {mode === 'history' && (
        <FlatList
          data={history}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={s.list}
          renderItem={({ item: p }) => (
            <View style={s.historyCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.historyDates}>
                  {fmtDate(p.started_at)} → {p.closed_at ? fmtDate(p.closed_at) : '—'}
                </Text>
                <View style={s.historyMetrics}>
                  <Text style={s.historyMeta}>Bruto: {fmt(p.total_value ?? 0)}</Text>
                  <Text style={[s.historyMeta, { color: GOLD }]}>
                    Lucro: {fmt(p.profit ?? 0)}
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="time-outline" size={48} color={t.border} />
              <Text style={s.emptyText}>Nenhum período encerrado</Text>
            </View>
          }
        />
      )}

      {/* ── Monthly ── */}
      {mode === 'monthly' && (
        <ScrollView contentContainerStyle={s.list}>
          <View style={s.monthlySearch}>
            <View style={s.monthlyInputGroup}>
              <Text style={s.monthlyLabel}>Mês</Text>
              <TextInput
                style={s.monthlyInput}
                value={monthInput}
                onChangeText={setMonthInput}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={t.placeholder}
              />
            </View>
            <View style={s.monthlyInputGroup}>
              <Text style={s.monthlyLabel}>Ano</Text>
              <TextInput
                style={s.monthlyInput}
                value={yearInput}
                onChangeText={setYearInput}
                keyboardType="number-pad"
                maxLength={4}
                placeholderTextColor={t.placeholder}
              />
            </View>
            <TouchableOpacity style={s.monthlyBtn} onPress={handleMonthlySearch}>
              <Ionicons name="search" size={18} color="#000" />
              <Text style={s.monthlyBtnText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {monthlyLoaded && (
            <>
              {monthlyPeriods.length > 0 && (
                <View style={s.monthlyTotals}>
                  <View style={s.metric}>
                    <Text style={s.metricLabel}>Total bruto</Text>
                    <Text style={s.metricVal}>{fmt(monthlyTotal)}</Text>
                  </View>
                  <View style={s.metric}>
                    <Text style={s.metricLabel}>Lucro</Text>
                    <Text style={[s.metricVal, { color: GOLD }]}>{fmt(monthlyProfit)}</Text>
                  </View>
                </View>
              )}
              {monthlyPeriods.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="calendar-outline" size={48} color={t.border} />
                  <Text style={s.emptyText}>Nenhum período neste mês</Text>
                </View>
              ) : (
                monthlyPeriods.map(p => (
                  <View key={p.id} style={s.historyCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyDates}>
                        {fmtDate(p.started_at)} → {p.closed_at ? fmtDate(p.closed_at) : '—'}
                      </Text>
                      <View style={s.historyMetrics}>
                        <Text style={s.historyMeta}>Bruto: {fmt(p.total_value ?? 0)}</Text>
                        <Text style={[s.historyMeta, { color: GOLD }]}>
                          Lucro: {fmt(p.profit ?? 0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Order detail modal ── */}
      <Modal visible={detailModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.detailHeader}>
              <View>
                <Text style={s.sheetTitle}>Pedido #{detailOrder?.id}</Text>
                <Text style={s.detailMeta}>
                  {detailOrder ? fmtDateTime(detailOrder.created_at) : ''}
                  {detailOrder?.payment_method_name ? ` · ${detailOrder.payment_method_name}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Ionicons name="close" size={24} color={t.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {detailItems.map(item => (
                <View key={item.id} style={s.detailItem}>
                  {item.product_image ? (
                    <Image source={{ uri: item.product_image }} style={s.detailImg} />
                  ) : (
                    <View style={[s.detailImg, s.imgPlaceholder]}>
                      <Ionicons name="wine-outline" size={16} color={t.border} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.detailName}>{item.product_name}</Text>
                    <Text style={s.detailSub}>{item.quantity} un · {fmt(item.unit_sale_price)}/un</Text>
                    {item.notes ? <Text style={s.detailNotes}>{item.notes}</Text> : null}
                  </View>
                  <Text style={s.detailTotal}>{fmt(item.total)}</Text>
                </View>
              ))}
            </ScrollView>

            {detailOrder && (
              <View style={s.detailFooter}>
                <View style={s.cartTotalRow}>
                  <Text style={s.cartTotalLabel}>Bruto</Text>
                  <Text style={s.cartTotalVal}>{fmt(detailOrder.total_value)}</Text>
                </View>
                {detailOrder.fee_value > 0 && (
                  <View style={s.cartTotalRow}>
                    <Text style={s.cartTotalLabel}>Taxa ({detailOrder.fee_pct}%)</Text>
                    <Text style={[s.cartTotalVal, { color: t.danger }]}>- {fmt(detailOrder.fee_value)}</Text>
                  </View>
                )}
                <View style={[s.cartTotalRow, { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[s.cartTotalLabel, { fontWeight: '700', color: t.text }]}>Líquido</Text>
                  <Text style={[s.cartTotalVal, { color: GOLD, fontSize: 16 }]}>{fmt(detailOrder.net_value)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: t.bg },
    tabBar: {
      flexDirection: 'row', backgroundColor: t.card,
      borderBottomWidth: 1, borderBottomColor: t.border, paddingHorizontal: 8,
    },
    tabBtn:         { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabBtnActive:   { borderBottomWidth: 2, borderBottomColor: GOLD },
    tabBtnText:     { fontSize: 13, color: t.sub, fontWeight: '600' },
    tabBtnTextActive: { color: GOLD },
    pmBtn:          { justifyContent: 'center', paddingHorizontal: 10 },
    list:           { padding: 12, paddingBottom: 40 },
    periodCard: {
      backgroundColor: '#0A0A0A', borderRadius: 14, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: GOLD,
    },
    periodSince:    { color: 'rgba(201,168,76,0.7)', fontSize: 12, marginBottom: 12 },
    periodMetrics:  { flexDirection: 'row', marginBottom: 14 },
    metric:         { flex: 1, alignItems: 'center' },
    metricLabel:    { color: 'rgba(201,168,76,0.7)', fontSize: 11, marginBottom: 2 },
    metricVal:      { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
    closeBtn: {
      backgroundColor: GOLD, borderRadius: 10, padding: 12,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    closeBtnText:   { color: '#000', fontWeight: '700', fontSize: 14 },
    orderCard: {
      backgroundColor: t.card, borderRadius: 12, padding: 12,
      marginBottom: 8, borderWidth: 1, borderColor: t.border,
    },
    orderTop:       { flexDirection: 'row', alignItems: 'center' },
    orderLeft:      { flex: 1 },
    orderDate:      { fontSize: 13, fontWeight: '600', color: t.text },
    orderMeta:      { fontSize: 12, color: t.sub, marginTop: 2 },
    orderRight:     { alignItems: 'flex-end', marginRight: 8 },
    orderGross:     { fontSize: 14, fontWeight: '700', color: t.text },
    orderNet:       { fontSize: 11, color: GOLD },
    historyCard: {
      backgroundColor: t.card, borderRadius: 12, padding: 14,
      marginBottom: 8, borderWidth: 1, borderColor: t.border,
    },
    historyDates:   { fontSize: 14, fontWeight: '600', color: t.text, marginBottom: 4 },
    historyMetrics: { flexDirection: 'row', gap: 16 },
    historyMeta:    { fontSize: 13, color: t.sub },
    empty:          { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyText:      { fontSize: 14, color: t.sub },
    monthlySearch: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16,
    },
    monthlyInputGroup: { flex: 1 },
    monthlyLabel:   { fontSize: 12, color: t.sub, marginBottom: 4, fontWeight: '600' },
    monthlyInput: {
      borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.inputBg,
      padding: 12, fontSize: 16, color: t.text, textAlign: 'center',
    },
    monthlyBtn: {
      backgroundColor: GOLD, borderRadius: 10, padding: 12, flexDirection: 'row',
      alignItems: 'center', gap: 6,
    },
    monthlyBtnText: { color: '#000', fontWeight: '700' },
    monthlyTotals: {
      backgroundColor: '#0A0A0A', borderRadius: 12, padding: 14,
      marginBottom: 12, borderWidth: 1, borderColor: GOLD,
      flexDirection: 'row',
    },
    overlay:        { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 36,
    },
    sheetTitle:     { fontSize: 17, fontWeight: 'bold', color: t.text },
    detailHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    detailMeta:     { fontSize: 12, color: t.sub, marginTop: 2 },
    detailItem: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: t.border, gap: 10,
    },
    detailImg:      { width: 40, height: 40, borderRadius: 8 },
    imgPlaceholder: { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    detailName:     { fontSize: 14, fontWeight: '600', color: t.text },
    detailSub:      { fontSize: 12, color: t.sub, marginTop: 1 },
    detailNotes:    { fontSize: 11, color: t.placeholder, fontStyle: 'italic' },
    detailTotal:    { fontSize: 14, fontWeight: '700', color: GOLD },
    detailFooter:   { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12, marginTop: 8 },
    cartTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    cartTotalLabel: { fontSize: 13, color: t.sub },
    cartTotalVal:   { fontSize: 13, fontWeight: '600', color: t.text },
  });
}
