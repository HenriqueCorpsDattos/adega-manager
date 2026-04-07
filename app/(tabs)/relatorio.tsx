import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, SectionList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getCurrentPeriod, getReportForPeriod, getClosedPeriods,
  closePeriod, getOrCreateCurrentPeriod,
  ReportPeriod, ReportExitRow,
} from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

const fmt     = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface State {
  period:   ReportPeriod | null;
  exits:    ReportExitRow[];
  history:  ReportPeriod[];
  total:    number;
}

export default function RelatorioScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [data, setData]       = useState<State>({ period: null, exits: [], history: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Garante que existe um período aberto
      await getOrCreateCurrentPeriod();
      const [period, history] = await Promise.all([getCurrentPeriod(), getClosedPeriods()]);
      const exits = period ? await getReportForPeriod(period.id) : [];
      const total = exits.reduce((sum, e) => sum + e.total, 0);
      setData({ period, exits, history, total });
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleClose = () => {
    if (!data.period) return;
    Alert.alert(
      'Fechar Período',
      `Fechar o período atual com total de ${fmt(data.total)}?\nUm novo período será iniciado automaticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fechar Período', style: 'destructive',
          onPress: async () => {
            setClosing(true);
            try {
              await closePeriod(data.period!.id);
              await load();
            } finally { setClosing(false); }
          },
        },
      ],
    );
  };

  if (loading) return <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <FlatList
        contentContainerStyle={s.list}
        data={data.exits}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={
          <>
            {/* Resumo do período atual */}
            <View style={s.periodCard}>
              <View style={s.periodCardTop}>
                <View>
                  <Text style={s.periodLabel}>Período atual</Text>
                  <Text style={s.periodDate}>
                    Desde {data.period ? fmtDate(data.period.started_at) : '—'}
                  </Text>
                </View>
                <View style={s.totalBox}>
                  <Text style={s.totalLabel}>Total vendido</Text>
                  <Text style={s.totalValue}>{fmt(data.total)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.closeBtn, closing && s.closeBtnDisabled]}
                onPress={handleClose}
                disabled={closing}
              >
                <Ionicons name="lock-closed-outline" size={16} color="#000" />
                <Text style={s.closeBtnText}>
                  {closing ? 'Fechando…' : 'Fechar Período'}
                </Text>
              </TouchableOpacity>
            </View>

            {data.exits.length > 0 && (
              <Text style={s.sectionTitle}>Saídas do período</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={s.exitCard}>
            {item.product_image ? (
              <Image source={{ uri: item.product_image }} style={s.img} />
            ) : (
              <View style={[s.img, s.imgPlaceholder]}>
                <Ionicons name="wine-outline" size={18} color={t.border} />
              </View>
            )}
            <View style={s.exitInfo}>
              <Text style={s.exitProduct}>{item.product_name}</Text>
              <Text style={s.exitDetail}>
                {item.quantity} un · {fmt(item.unit_sale_price)}/un
              </Text>
              {item.notes ? <Text style={s.exitNotes}>{item.notes}</Text> : null}
              <Text style={s.exitDate}>{fmtDateTime(item.exit_date)}</Text>
            </View>
            <Text style={s.exitTotal}>{fmt(item.total)}</Text>
          </View>
        )}
        ListEmptyComponent={
          data.exits.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={48} color={t.border} />
              <Text style={s.emptyText}>Nenhuma saída neste período</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          data.history.length > 0 ? (
            <View style={s.historySection}>
              <Text style={s.sectionTitle}>Períodos anteriores</Text>
              {data.history.map(p => (
                <View key={p.id} style={s.historyCard}>
                  <View>
                    <Text style={s.historyDate}>
                      {fmtDate(p.started_at)} → {p.closed_at ? fmtDate(p.closed_at) : '—'}
                    </Text>
                  </View>
                  <Text style={s.historyValue}>{fmt(p.total_value ?? 0)}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: t.bg },
    list:         { padding: 12, paddingBottom: 40 },
    periodCard: {
      backgroundColor: '#0A0A0A', borderRadius: 14, padding: 16,
      marginBottom: 16, borderWidth: 1, borderColor: GOLD,
    },
    periodCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    periodLabel:    { color: 'rgba(201,168,76,0.8)', fontSize: 12 },
    periodDate:     { color: '#FFF', fontSize: 14, fontWeight: '600', marginTop: 2 },
    totalBox:       { alignItems: 'flex-end' },
    totalLabel:     { color: 'rgba(201,168,76,0.8)', fontSize: 12 },
    totalValue:     { color: GOLD, fontSize: 22, fontWeight: 'bold', marginTop: 2 },
    closeBtn: {
      backgroundColor: GOLD, borderRadius: 10, padding: 12,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    closeBtnDisabled: { opacity: 0.6 },
    closeBtnText:   { color: '#000', fontWeight: '700', fontSize: 14 },
    sectionTitle:   { fontSize: 14, fontWeight: '700', color: t.sub, marginBottom: 8, marginTop: 4 },
    exitCard: {
      backgroundColor: t.card, borderRadius: 12, padding: 12,
      marginBottom: 8, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    img:          { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
    imgPlaceholder: { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    exitInfo:     { flex: 1 },
    exitProduct:  { fontSize: 14, fontWeight: '600', color: t.text },
    exitDetail:   { fontSize: 12, color: t.sub, marginTop: 1 },
    exitNotes:    { fontSize: 11, color: t.placeholder, fontStyle: 'italic', marginTop: 1 },
    exitDate:     { fontSize: 11, color: t.placeholder, marginTop: 2 },
    exitTotal:    { fontSize: 14, fontWeight: '700', color: GOLD },
    empty:        { alignItems: 'center', paddingVertical: 24, gap: 8 },
    emptyText:    { fontSize: 14, color: t.sub },
    historySection: { marginTop: 8 },
    historyCard: {
      backgroundColor: t.card, borderRadius: 10, padding: 12,
      marginBottom: 6, flexDirection: 'row',
      justifyContent: 'space-between', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    historyDate:  { fontSize: 13, color: t.text, fontWeight: '500' },
    historyValue: { fontSize: 14, fontWeight: '700', color: GOLD },
  });
}
