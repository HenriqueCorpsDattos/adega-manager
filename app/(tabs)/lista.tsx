import React, { useState, useCallback } from 'react';
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

const WINE = '#722F37';

export default function ListaScreen() {
  const [list, setList]           = useState<ShoppingListItem[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [selected, setSelected]   = useState<Product | null>(null);
  const [quantity, setQuantity]   = useState('');
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, prodData] = await Promise.all([getShoppingList(), getProducts()]);
      setList(listData);
      setProducts(prodData);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openModal = () => {
    setSelected(null);
    setQuantity('');
    setSearch('');
    setModal(true);
  };

  const handleAdd = async () => {
    if (!selected) { Alert.alert('Atenção', 'Selecione um produto.'); return; }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { Alert.alert('Atenção', 'Informe uma quantidade válida.'); return; }
    await addToShoppingList(selected.id, qty);
    setModal(false);
    await load();
  };

  const handleRemove = (item: ShoppingListItem) => {
    Alert.alert(
      'Remover',
      `Remover "${item.product_name}" da lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive',
          onPress: async () => { await removeFromShoppingList(item.id); await load(); } },
      ]
    );
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading ? (
        <ActivityIndicator size="large" color={WINE} style={{ marginTop: 40 }} />
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
                  <Ionicons name="wine-outline" size={22} color="#CCC" />
                </View>
              )}
              <View style={s.cardInfo}>
                <Text style={s.productName}>{item.product_name}</Text>
                <Text style={s.qty}>{item.quantity_desired} unidades</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemove(item)} style={s.removeBtn}>
                <Ionicons name="trash-outline" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="list-outline" size={64} color="#DDD" />
              <Text style={s.emptyText}>Lista vazia</Text>
              <Text style={s.emptyHint}>Toque em + para adicionar produtos</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={s.fab} onPress={openModal}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Modal — selecionar produto */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Adicionar à Lista</Text>

            {/* Busca */}
            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color="#999" style={s.searchIcon} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar produto…"
                placeholderTextColor="#BBB"
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {/* Lista de produtos */}
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
                      <Ionicons name="wine-outline" size={14} color="#CCC" />
                    </View>
                  )}
                  <Text style={s.optName}>{item.name}</Text>
                  {selected?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={WINE} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.noProducts}>Nenhum produto encontrado.</Text>}
            />

            {/* Quantidade */}
            <TextInput
              style={s.input}
              placeholder="Quantidade"
              placeholderTextColor="#BBB"
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

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5F0EB' },
  list:         { padding: 12, paddingBottom: 80 },
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 12,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  img:          { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  imgPlaceholder: { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  cardInfo:     { flex: 1 },
  productName:  { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  qty:          { fontSize: 13, color: '#666', marginTop: 2 },
  removeBtn:    { padding: 8 },
  empty:        { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText:    { fontSize: 16, color: '#999', fontWeight: '500' },
  emptyHint:    { fontSize: 13, color: '#BBB' },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    backgroundColor: WINE, width: 56, height: 56,
    borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 5,
  },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '85%',
  },
  sheetTitle:   { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 12 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 },
  searchIcon:   { marginRight: 6 },
  searchInput:  { flex: 1, height: 40, fontSize: 15, color: '#1A1A1A' },
  productList:  { maxHeight: 220, marginBottom: 12 },
  productOption: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderRadius: 8, marginBottom: 4, backgroundColor: '#F9F9F9',
  },
  productOptionSelected: { backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: WINE },
  optImg:       { width: 32, height: 32, borderRadius: 6, marginRight: 10 },
  optName:      { flex: 1, fontSize: 14, color: '#1A1A1A' },
  noProducts:   { textAlign: 'center', color: '#BBB', padding: 12 },
  input: {
    borderWidth: 1, borderColor: '#DDD', borderRadius: 10,
    padding: 12, fontSize: 16, color: '#1A1A1A', marginBottom: 16,
  },
  btnRow:       { flexDirection: 'row', gap: 12 },
  btn:          { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnCancel:    { backgroundColor: '#F0F0F0' },
  btnCancelText: { color: '#555', fontWeight: '600' },
  btnSave:      { backgroundColor: WINE },
  btnSaveText:  { color: '#FFF', fontWeight: '600' },
});
