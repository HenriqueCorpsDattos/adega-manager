import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  Image, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getShoppingList, getProducts, addToShoppingList,
  removeFromShoppingList, Product, ShoppingListItem,
} from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

export default function ListaScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [list, setList]         = useState<ShoppingListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, prodData] = await Promise.all([getShoppingList(), getProducts()]);
      setList(listData);
      setProducts(prodData);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!selected) { Alert.alert('Atenção', 'Selecione um produto.'); return; }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { Alert.alert('Atenção', 'Informe uma quantidade válida.'); return; }
    await addToShoppingList(selected.id, qty);
    setModal(false);
    await load();
  };

  const handleRemove = (item: ShoppingListItem) => {
    Alert.alert('Remover', `Remover "${item.product_name}" da lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive',
        onPress: async () => { await removeFromShoppingList(item.id); await load(); } },
    ]);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.card}>
              {item.product_image ? (
                <Image source={{ uri: item.product_image }} style={s.img} />
              ) : (
                <View style={[s.img, s.imgPlaceholder]}>
                  <Ionicons name="wine-outline" size={22} color={t.border} />
                </View>
              )}
              <View style={s.cardInfo}>
                <Text style={s.productName}>{item.product_name}</Text>
                <Text style={s.qty}>{item.quantity_desired} unidades</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemove(item)} style={s.removeBtn}>
                <Ionicons name="trash-outline" size={20} color={t.danger} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="list-outline" size={64} color={t.border} />
              <Text style={s.emptyText}>Lista vazia</Text>
              <Text style={s.emptyHint}>Toque em + para adicionar produtos</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => { setSelected(null); setQuantity(''); setSearch(''); setModal(true); }}>
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Adicionar à Lista</Text>

            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color={t.sub} style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar produto…"
                placeholderTextColor={t.placeholder}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={item => String(item.id)}
              style={s.productList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.productOption, selected?.id === item.id && s.productOptionSelected]}
                  onPress={() => setSelected(item)}
                >
                  {item.image_uri ? (
                    <Image source={{ uri: item.image_uri }} style={s.optImg} />
                  ) : (
                    <View style={[s.optImg, s.imgPlaceholder]}>
                      <Ionicons name="wine-outline" size={14} color={t.border} />
                    </View>
                  )}
                  <Text style={s.optName}>{item.name}</Text>
                  {selected?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={GOLD} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.noProducts}>Nenhum produto encontrado.</Text>}
            />

            <TextInput
              style={s.input}
              placeholder="Quantidade"
              placeholderTextColor={t.placeholder}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
            />

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setModal(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleAdd}>
                <Text style={s.btnSaveText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: t.bg },
    list:        { padding: 12, paddingBottom: 80 },
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 12,
      marginBottom: 10, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    img:          { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
    imgPlaceholder: { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    cardInfo:     { flex: 1 },
    productName:  { fontSize: 15, fontWeight: '600', color: t.text },
    qty:          { fontSize: 13, color: t.sub, marginTop: 2 },
    removeBtn:    { padding: 8 },
    empty:        { alignItems: 'center', marginTop: 80, gap: 8 },
    emptyText:    { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint:    { fontSize: 13, color: t.placeholder },
    fab: {
      position: 'absolute', right: 20, bottom: 20,
      backgroundColor: GOLD, width: 56, height: 56,
      borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 5,
    },
    overlay:      { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 40, maxHeight: '85%',
    },
    sheetTitle:   { fontSize: 18, fontWeight: 'bold', color: t.text, marginBottom: 12 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.searchBg, borderRadius: 10,
      paddingHorizontal: 10, marginBottom: 8,
    },
    searchInput:  { flex: 1, height: 40, fontSize: 15, color: t.text },
    productList:  { maxHeight: 220, marginBottom: 12 },
    productOption: {
      flexDirection: 'row', alignItems: 'center', padding: 10,
      borderRadius: 8, marginBottom: 4, backgroundColor: t.optionBg,
    },
    productOptionSelected: { backgroundColor: t.optionSelectedBg, borderWidth: 1, borderColor: GOLD },
    optImg:       { width: 32, height: 32, borderRadius: 6, marginRight: 10 },
    optName:      { flex: 1, fontSize: 14, color: t.text },
    noProducts:   { textAlign: 'center', color: t.placeholder, padding: 12 },
    input: {
      borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.inputBg,
      padding: 12, fontSize: 16, color: t.text, marginBottom: 16,
    },
    btnRow:       { flexDirection: 'row', gap: 12 },
    btn:          { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    btnCancel:    { backgroundColor: t.badge },
    btnCancelText: { color: t.sub, fontWeight: '600' },
    btnSave:      { backgroundColor: GOLD },
    btnSaveText:  { color: '#000', fontWeight: '700' },
  });
}
