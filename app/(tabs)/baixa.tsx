import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, Modal, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStockInfo, registerExit, StockInfo } from '../../src/database/db';

const WINE = '#722F37';

export default function BaixaScreen() {
  const [stock, setStock]     = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [selected, setSelected] = useState<StockInfo | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStockInfo();
      setStock(data.filter(s => s.total_quantity > 0));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openModal = (item: StockInfo) => {
    setSelected(item);
    setQuantity('');
    setNotes('');
    setModal(true);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Atenção', 'Informe uma quantidade válida.'); return;
    }
    if (qty > selected.total_quantity) {
      Alert.alert('Estoque insuficiente', `Disponível: ${selected.total_quantity} un`); return;
    }
    setSaving(true);
    try {
      await registerExit(selected.product_id, qty, notes);
      setModal(false);
      Alert.alert('Sucesso!', 'Baixa registrada com sucesso.');
      await load();
    } finally { setSaving(false); }
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
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => openModal(item)}>
              {item.product_image ? (
                <Image source={{ uri: item.product_image }} style={s.img} />
              ) : (
                <View style={[s.img, s.imgPlaceholder]}>
                  <Ionicons name="wine-outline" size={22} color="#CCC" />
                </View>
              )}
              <View style={s.cardInfo}>
                <Text style={s.productName}>{item.product_name}</Text>
                <Text style={s.stockText}>{item.total_quantity} unidades em estoque</Text>
              </View>
              <Ionicons name="remove-circle-outline" size={28} color={WINE} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="arrow-up-circle-outline" size={64} color="#DDD" />
              <Text style={s.emptyText}>Nenhum produto em estoque</Text>
              <Text style={s.emptyHint}>Registre uma entrada primeiro</Text>
            </View>
          }
        />
      )}

      {/* Modal dar baixa */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Dar Baixa</Text>
            {selected && (
              <>
                <Text style={s.selectedName}>{selected.product_name}</Text>
                <Text style={s.stockInfo}>
                  Estoque atual: {selected.total_quantity} unidades
                </Text>
                <Text style={s.fieldLabel}>Quantidade a baixar</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor="#BBB"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <Text style={s.fieldLabel}>Observação (opcional)</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  placeholder="Ex: Venda, consumo próprio…"
                  placeholderTextColor="#BBB"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />
              </>
            )}
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setModal(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleConfirm} disabled={saving}>
                <Text style={s.btnSaveText}>{saving ? 'Salvando…' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F0EB' },
  list:       { padding: 12 },
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 12,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  img:        { width: 52, height: 52, borderRadius: 8, marginRight: 12 },
  imgPlaceholder: { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  cardInfo:   { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 3 },
  stockText:  { fontSize: 13, color: '#666' },
  empty:      { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText:  { fontSize: 16, color: '#999', fontWeight: '500' },
  emptyHint:  { fontSize: 13, color: '#BBB' },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  sheetTitle:   { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
  selectedName: { fontSize: 16, fontWeight: '700', color: WINE, marginBottom: 2 },
  stockInfo:    { fontSize: 13, color: '#666', marginBottom: 16 },
  fieldLabel:   { fontSize: 13, color: '#888', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#DDD', borderRadius: 10,
    padding: 12, fontSize: 16, color: '#1A1A1A', marginBottom: 14,
  },
  textArea:   { height: 80, textAlignVertical: 'top' },
  btnRow:     { flexDirection: 'row', gap: 12 },
  btn:        { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnCancel:  { backgroundColor: '#F0F0F0' },
  btnCancelText: { color: '#555', fontWeight: '600' },
  btnSave:    { backgroundColor: WINE },
  btnSaveText: { color: '#FFF', fontWeight: '600' },
});
