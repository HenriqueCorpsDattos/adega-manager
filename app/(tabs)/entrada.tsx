import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  FlatList, Image, Modal, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getShoppingList, getProducts, registerEntry, markShoppingListDone, Product,
} from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

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
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [items, setItems]       = useState<EntryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [selectorOpen, setSelector] = useState(false);
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, prodData] = await Promise.all([getShoppingList(), getProducts()]);
      setProducts(prodData);
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

  const update = (index: number, field: keyof EntryItem, value: string) =>
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));

  const remove = (index: number) =>
    setItems(prev => prev.filter((_, i) => i !== index));

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
    if (items.length === 0) { Alert.alert('Atenção', 'Adicione ao menos um produto.'); return; }
    for (const item of items) {
      if (!parseFloat(item.quantity) || parseFloat(item.quantity) <= 0)
        return Alert.alert('Atenção', `Quantidade inválida: "${item.product_name}".`);
      if (!parseFloat(item.purchase_price) || parseFloat(item.purchase_price) <= 0)
        return Alert.alert('Atenção', `Preço de compra inválido: "${item.product_name}".`);
      if (item.margin_pct === '' || isNaN(parseFloat(item.margin_pct)))
        return Alert.alert('Atenção', `Margem inválida: "${item.product_name}".`);
    }

    Alert.alert('Confirmar Entrada', `Registrar ${items.length} produto(s)?`, [
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
            Alert.alert('Sucesso!', 'Entrada registrada.');
            await load();
          } finally { setSaving(false); }
        },
      },
    ]);
  };

  const salePreview = (item: EntryItem) => {
    const price  = parseFloat(item.purchase_price);
    const margin = parseFloat(item.margin_pct);
    if (!price || isNaN(margin)) return null;
    return (price * (1 + margin / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {items.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="arrow-down-circle-outline" size={64} color={t.border} />
            <Text style={s.emptyText}>Lista de compras vazia</Text>
            <Text style={s.emptyHint}>Adicione produtos abaixo</Text>
          </View>
        )}

        {items.map((item, index) => {
          const preview = salePreview(item);
          return (
            <View key={`${item.product_id}-${index}`} style={s.card}>
              <View style={s.cardHeader}>
                {item.product_image ? (
                  <Image source={{ uri: item.product_image }} style={s.img} />
                ) : (
                  <View style={[s.img, s.imgPlaceholder]}>
                    <Ionicons name="wine-outline" size={18} color={t.border} />
                  </View>
                )}
                <Text style={s.productName} numberOfLines={1}>{item.product_name}</Text>
                {item.shopping_list_id && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>Lista</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => remove(index)} style={s.removeBtn}>
                  <Ionicons name="close-circle" size={22} color={t.danger} />
                </TouchableOpacity>
              </View>

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
                      placeholderTextColor={t.placeholder}
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
                      placeholderTextColor={t.placeholder}
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
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                {preview && (
                  <Text style={s.preview}>Preço de venda: {preview}</Text>
                )}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={s.addBtn} onPress={() => { setSearch(''); setSelector(true); }}>
          <Ionicons name="add-circle-outline" size={20} color={GOLD} />
          <Text style={s.addBtnText}>Adicionar produto manualmente</Text>
        </TouchableOpacity>

        {items.length > 0 && (
          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} disabled={saving}>
            <Text style={s.confirmBtnText}>
              {saving ? 'Registrando…' : `Confirmar Entrada (${items.length} item${items.length > 1 ? 's' : ''})`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={selectorOpen} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Selecionar Produto</Text>
            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color={t.sub} style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar produto…"
                placeholderTextColor={t.placeholder}
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
                      <Ionicons name="wine-outline" size={14} color={t.border} />
                    </View>
                  )}
                  <Text style={s.selectorName}>{item.name}</Text>
                  <Ionicons name="add-circle-outline" size={20} color={GOLD} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: t.placeholder, textAlign: 'center', padding: 12 }}>Nenhum produto encontrado.</Text>}
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: t.bg },
    scroll:      { padding: 12, paddingBottom: 40 },
    empty:       { alignItems: 'center', marginVertical: 32, gap: 8 },
    emptyText:   { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint:   { fontSize: 13, color: t.placeholder },
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: t.border,
    },
    cardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    img:         { width: 38, height: 38, borderRadius: 6, marginRight: 10 },
    imgPlaceholder: { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    productName: { flex: 1, fontSize: 15, fontWeight: '600', color: t.text },
    badge:       { backgroundColor: t.badge, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6, borderWidth: 1, borderColor: GOLD },
    badgeText:   { fontSize: 11, color: GOLD, fontWeight: '600' },
    removeBtn:   { padding: 2 },
    fields:      { gap: 8 },
    fieldRow:    { flexDirection: 'row' },
    field:       { flex: 1 },
    fieldLabel:  { fontSize: 12, color: t.sub, marginBottom: 4 },
    fieldInput: {
      borderWidth: 1, borderColor: t.border, borderRadius: 8, backgroundColor: t.inputBg,
      paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: t.text,
    },
    preview:     { fontSize: 13, color: GOLD, fontWeight: '600' },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: GOLD, borderStyle: 'dashed',
      borderRadius: 10, padding: 14, gap: 8, marginBottom: 16,
    },
    addBtnText:  { color: GOLD, fontWeight: '600', fontSize: 15 },
    confirmBtn:  { backgroundColor: GOLD, padding: 16, borderRadius: 12, alignItems: 'center' },
    confirmBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
    overlay:     { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 40,
    },
    sheetTitle:  { fontSize: 18, fontWeight: 'bold', color: t.text, marginBottom: 12 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.searchBg, borderRadius: 10,
      paddingHorizontal: 10, marginBottom: 8,
    },
    searchInput: { flex: 1, height: 40, fontSize: 15, color: t.text },
    selectorItem: {
      flexDirection: 'row', alignItems: 'center', padding: 10,
      borderRadius: 8, marginBottom: 4, backgroundColor: t.optionBg,
    },
    selectorImg:  { width: 34, height: 34, borderRadius: 6, marginRight: 10 },
    selectorName: { flex: 1, fontSize: 14, color: t.text },
    cancelBtn:    { backgroundColor: t.badge, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
    cancelBtnText: { color: t.sub, fontWeight: '600' },
  });
}
