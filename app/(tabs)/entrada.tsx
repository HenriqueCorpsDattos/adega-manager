import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  FlatList, Image, Modal, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getShoppingList, getProducts, registerEntry, markShoppingListDone,
  Product,
} from '../../src/database/db';

const WINE = '#722F37';

interface EntryItem {
  product_id:       number;
  product_name:     string;
  product_image:    string | null;
  quantity:         string;
  purchase_price:   string;
  margin_pct:       string;
  shopping_list_id: number | null;
}

export default function EntradaScreen() {
  const [items, setItems]           = useState<EntryItem[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [selectorOpen, setSelector] = useState(false);
  const [search, setSearch]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, prodData] = await Promise.all([getShoppingList(), getProducts()]);
      setProducts(prodData);
      // Pré-popula com itens da lista de compras
      setItems(listData.map(li => ({
        product_id:       li.product_id,
        product_name:     li.product_name,
        product_image:    li.product_image,
        quantity:         String(li.quantity_desired),
        purchase_price:   '',
        margin_pct:       '',
        shopping_list_id: li.id,
      })));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = (index: number, field: keyof EntryItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const remove = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addManual = (product: Product) => {
    if (items.some(i => i.product_id === product.id)) {
      Alert.alert('Aviso', 'Este produto já está na lista de entrada.');
      setSelector(false);
      return;
    }
    setItems(prev => [...prev, {
      product_id:       product.id,
      product_name:     product.name,
      product_image:    product.image_uri,
      quantity:         '',
      purchase_price:   '',
      margin_pct:       '',
      shopping_list_id: null,
    }]);
    setSelector(false);
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      Alert.alert('Atenção', 'Adicione ao menos um produto.');
      return;
    }
    for (const item of items) {
      if (!parseFloat(item.quantity) || parseFloat(item.quantity) <= 0)
        return Alert.alert('Atenção', `Quantidade inválida: "${item.product_name}".`);
      if (!parseFloat(item.purchase_price) || parseFloat(item.purchase_price) <= 0)
        return Alert.alert('Atenção', `Preço de compra inválido: "${item.product_name}".`);
      if (item.margin_pct === '' || isNaN(parseFloat(item.margin_pct)))
        return Alert.alert('Atenção', `Margem inválida: "${item.product_name}".`);
    }

    Alert.alert(
      'Confirmar Entrada',
      `Registrar entrada de ${items.length} produto(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            setSaving(true);
            try {
              for (const item of items) {
                await registerEntry(
                  item.product_id,
                  parseFloat(item.quantity),
                  parseFloat(item.purchase_price),
                  parseFloat(item.margin_pct),
                );
                if (item.shopping_list_id) await markShoppingListDone(item.shopping_list_id);
              }
              Alert.alert('Sucesso!', 'Entrada registrada com sucesso.');
              await load();
            } finally { setSaving(false); }
          },
        },
      ]
    );
  };

  const salePreview = (item: EntryItem) => {
    const price  = parseFloat(item.purchase_price);
    const margin = parseFloat(item.margin_pct);
    if (!price || isNaN(margin)) return null;
    return (price * (1 + margin / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <ActivityIndicator size="large" color={WINE} style={{ marginTop: 60 }} />;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {items.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="arrow-down-circle-outline" size={64} color="#DDD" />
            <Text style={s.emptyText}>Nenhum item da lista de compras</Text>
            <Text style={s.emptyHint}>Adicione produtos manualmente abaixo</Text>
          </View>
        )}

        {items.map((item, index) => {
          const preview = salePreview(item);
          return (
            <View key={`${item.product_id}-${index}`} style={s.card}>
              {/* Cabeçalho do card */}
              <View style={s.cardHeader}>
                {item.product_image ? (
                  <Image source={{ uri: item.product_image }} style={s.img} />
                ) : (
                  <View style={[s.img, s.imgPlaceholder]}>
                    <Ionicons name="wine-outline" size={18} color="#CCC" />
                  </View>
                )}
                <Text style={s.productName} numberOfLines={1}>{item.product_name}</Text>
                {item.shopping_list_id && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>Lista</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => remove(index)} style={s.removeBtn}>
                  <Ionicons name="close-circle" size={22} color="#E74C3C" />
                </TouchableOpacity>
              </View>

              {/* Campos */}
              <View style={s.fields}>
                <View style={s.fieldRow}>
                  <View style={[s.field, { marginRight: 8 }]}>
                    <Text style={s.fieldLabel}>Quantidade</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={item.quantity}
                      onChangeText={v => update(index, 'quantity', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#BBB"
                    />
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Margem (%)</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={item.margin_pct}
                      onChangeText={v => update(index, 'margin_pct', v)}
                      keyboardType="decimal-pad"
                      placeholder="30"
                      placeholderTextColor="#BBB"
                    />
                  </View>
                </View>
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Preço de Compra (R$)</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={item.purchase_price}
                    onChangeText={v => update(index, 'purchase_price', v)}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor="#BBB"
                  />
                </View>
                {preview && (
                  <Text style={s.preview}>Preço de venda calculado: {preview}</Text>
                )}
              </View>
            </View>
          );
        })}

        {/* Botão adicionar manualmente */}
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setSearch(''); setSelector(true); }}
        >
          <Ionicons name="add-circle-outline" size={20} color={WINE} />
          <Text style={s.addBtnText}>Adicionar produto manualmente</Text>
        </TouchableOpacity>

        {/* Botão confirmar */}
        {items.length > 0 && (
          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} disabled={saving}>
            <Text style={s.confirmBtnText}>
              {saving ? 'Registrando…' : `Confirmar Entrada (${items.length} item${items.length > 1 ? 's' : ''})`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Seletor de produto */}
      <Modal visible={selectorOpen} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Selecionar Produto</Text>
            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color="#999" style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar produto…"
                placeholderTextColor="#BBB"
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredProducts}
              keyExtractor={item => String(item.id)}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.selectorItem} onPress={() => addManual(item)}>
                  {item.image_uri ? (
                    <Image source={{ uri: item.image_uri }} style={s.selectorImg} />
                  ) : (
                    <View style={[s.selectorImg, s.imgPlaceholder]}>
                      <Ionicons name="wine-outline" size={14} color="#CCC" />
                    </View>
                  )}
                  <Text style={s.selectorName}>{item.name}</Text>
                  <Ionicons name="add-circle-outline" size={20} color={WINE} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: '#BBB', textAlign: 'center', padding: 12 }}>Nenhum produto encontrado.</Text>}
            />
            <TouchableOpacity style={s.cancelBtn} onPress={() => setSelector(false)}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F0EB' },
  scroll:     { padding: 12, paddingBottom: 40 },
  empty:      { alignItems: 'center', marginVertical: 32, gap: 8 },
  emptyText:  { fontSize: 16, color: '#999', fontWeight: '500' },
  emptyHint:  { fontSize: 13, color: '#BBB' },
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 14,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  img:        { width: 38, height: 38, borderRadius: 6, marginRight: 10 },
  imgPlaceholder: { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  productName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  badge:      { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 },
  badgeText:  { fontSize: 11, color: '#27AE60', fontWeight: '600' },
  removeBtn:  { padding: 2 },
  fields:     { gap: 8 },
  fieldRow:   { flexDirection: 'row' },
  field:      { flex: 1 },
  fieldLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: '#1A1A1A',
  },
  preview:    { fontSize: 13, color: '#27AE60', fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: WINE, borderStyle: 'dashed',
    borderRadius: 10, padding: 14, gap: 8, marginBottom: 16,
  },
  addBtnText: { color: WINE, fontWeight: '600', fontSize: 15 },
  confirmBtn: {
    backgroundColor: WINE, padding: 16, borderRadius: 12, alignItems: 'center',
  },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
  },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 12 },
  searchRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 },
  searchInput: { flex: 1, height: 40, fontSize: 15, color: '#1A1A1A' },
  selectorItem: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderRadius: 8, marginBottom: 4, backgroundColor: '#F9F9F9',
  },
  selectorImg:  { width: 34, height: 34, borderRadius: 6, marginRight: 10 },
  selectorName: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  cancelBtn:    { backgroundColor: '#F0F0F0', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#555', fontWeight: '600' },
});
