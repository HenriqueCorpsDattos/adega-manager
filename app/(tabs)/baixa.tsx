import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, Modal, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStockLots, registerExitFromLot, StockLot } from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

interface ProductGroup {
  product_id:    number;
  product_name:  string;
  product_image: string | null;
  total_qty:     number;
  lots:          StockLot[];
}

function groupLots(lots: StockLot[]): ProductGroup[] {
  const map = new Map<number, ProductGroup>();
  for (const lot of lots) {
    if (!map.has(lot.product_id)) {
      map.set(lot.product_id, {
        product_id: lot.product_id, product_name: lot.product_name,
        product_image: lot.product_image, total_qty: 0, lots: [],
      });
    }
    const g = map.get(lot.product_id)!;
    g.lots.push(lot);
    g.total_qty += lot.remaining_quantity;
  }
  return Array.from(map.values());
}

export default function BaixaScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [groups, setGroups]           = useState<ProductGroup[]>([]);
  const [loading, setLoading]         = useState(true);
  const [productModal, setProductModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [selectedLot, setSelectedLot] = useState<StockLot | null>(null);
  const [quantity, setQuantity]       = useState('');
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lots = await getStockLots();
      setGroups(groupLots(lots));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openProduct = (g: ProductGroup) => {
    setSelectedGroup(g);
    setSelectedLot(null);
    setQuantity('');
    setNotes('');
    setProductModal(true);
  };

  const handleConfirm = async () => {
    if (!selectedLot || !selectedGroup) return;
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { Alert.alert('Atenção', 'Informe uma quantidade válida.'); return; }
    if (qty > selectedLot.remaining_quantity) {
      Alert.alert('Estoque insuficiente', `Disponível neste lote: ${selectedLot.remaining_quantity} un`);
      return;
    }
    setSaving(true);
    try {
      await registerExitFromLot(selectedLot.entry_id, selectedLot.product_id, qty, notes);
      setProductModal(false);
      Alert.alert('Sucesso!', 'Baixa registrada.');
      await load();
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => String(g.product_id)}
          contentContainerStyle={s.list}
          renderItem={({ item: g }) => (
            <TouchableOpacity style={s.card} onPress={() => openProduct(g)}>
              {g.product_image ? (
                <Image source={{ uri: g.product_image }} style={s.img} />
              ) : (
                <View style={[s.img, s.imgPlaceholder]}>
                  <Ionicons name="wine-outline" size={22} color={t.border} />
                </View>
              )}
              <View style={s.cardInfo}>
                <Text style={s.productName}>{g.product_name}</Text>
                <Text style={s.stockText}>
                  {g.total_qty} un · {g.lots.length} lote{g.lots.length > 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.sub} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="arrow-up-circle-outline" size={64} color={t.border} />
              <Text style={s.emptyText}>Nenhum produto em estoque</Text>
              <Text style={s.emptyHint}>Registre uma entrada primeiro</Text>
            </View>
          }
        />
      )}

      {/* Modal: lotes do produto */}
      <Modal visible={productModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{selectedGroup?.product_name}</Text>

            {/* Lista de lotes disponíveis */}
            <Text style={s.sectionLabel}>Selecione o lote:</Text>
            <ScrollView style={s.lotList} showsVerticalScrollIndicator={false}>
              {selectedGroup?.lots.map(lot => (
                <TouchableOpacity
                  key={lot.entry_id}
                  style={[s.lotItem, selectedLot?.entry_id === lot.entry_id && s.lotItemSelected]}
                  onPress={() => setSelectedLot(lot)}
                >
                  <View style={s.lotItemLeft}>
                    <Text style={s.lotDate}>Lote {fmtDate(lot.entry_date)}</Text>
                    <Text style={s.lotDetail}>
                      {lot.remaining_quantity} un · Venda {fmt(lot.sale_price)}
                    </Text>
                    <Text style={s.lotDetail}>
                      Compra {fmt(lot.purchase_price)} · Margem {lot.margin_pct.toFixed(1)}%
                    </Text>
                  </View>
                  {selectedLot?.entry_id === lot.entry_id && (
                    <Ionicons name="checkmark-circle" size={22} color={GOLD} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Formulário de baixa */}
            {selectedLot && (
              <View style={s.exitForm}>
                <Text style={s.fieldLabel}>Quantidade a baixar (máx: {selectedLot.remaining_quantity})</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor={t.placeholder}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
                <Text style={s.fieldLabel}>Observação (opcional)</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  placeholder="Ex: venda, consumo próprio…"
                  placeholderTextColor={t.placeholder}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            )}

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setProductModal(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              {selectedLot && (
                <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleConfirm} disabled={saving}>
                  <Text style={s.btnSaveText}>{saving ? 'Salvando…' : 'Confirmar Baixa'}</Text>
                </TouchableOpacity>
              )}
            </View>
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
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 12,
      marginBottom: 10, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    img:        { width: 52, height: 52, borderRadius: 8, marginRight: 12 },
    imgPlaceholder: { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    cardInfo:   { flex: 1 },
    productName: { fontSize: 15, fontWeight: '600', color: t.text, marginBottom: 3 },
    stockText:  { fontSize: 13, color: t.sub },
    empty:      { alignItems: 'center', marginTop: 80, gap: 8 },
    emptyText:  { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint:  { fontSize: 13, color: t.placeholder },
    overlay:    { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 40, maxHeight: '90%',
    },
    sheetTitle:    { fontSize: 18, fontWeight: 'bold', color: t.text, marginBottom: 12 },
    sectionLabel:  { fontSize: 13, color: t.sub, fontWeight: '600', marginBottom: 8 },
    lotList:       { maxHeight: 220, marginBottom: 12 },
    lotItem: {
      flexDirection: 'row', alignItems: 'center', padding: 12,
      borderRadius: 10, marginBottom: 6, backgroundColor: t.optionBg,
      borderWidth: 1, borderColor: t.border,
    },
    lotItemSelected: { backgroundColor: t.optionSelectedBg, borderColor: GOLD },
    lotItemLeft:   { flex: 1 },
    lotDate:       { fontSize: 14, fontWeight: '700', color: t.text, marginBottom: 2 },
    lotDetail:     { fontSize: 12, color: t.sub },
    exitForm:      { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12, marginBottom: 8 },
    fieldLabel:    { fontSize: 12, color: t.sub, marginBottom: 4 },
    input: {
      borderWidth: 1, borderColor: t.border, borderRadius: 8, backgroundColor: t.inputBg,
      padding: 10, fontSize: 15, color: t.text, marginBottom: 10,
    },
    textArea: { height: 64, textAlignVertical: 'top' },
    btnRow:    { flexDirection: 'row', gap: 12 },
    btn:       { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    btnCancel: { backgroundColor: t.badge },
    btnCancelText: { color: t.sub, fontWeight: '600' },
    btnSave:   { backgroundColor: GOLD },
    btnSaveText: { color: '#000', fontWeight: '700' },
  });
}
