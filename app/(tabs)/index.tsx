import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  Image, StyleSheet, Alert, ActivityIndicator, Switch, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getProducts, createProduct, updateProduct, deleteProduct, Product,
  getIngredients, saveIngredients, Ingredient,
} from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

export default function ProdutosScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [editing, setEditing]       = useState<Product | null>(null);
  const [name, setName]             = useState('');
  const [imageUri, setImageUri]     = useState<string | null>(null);
  const [renewsStock, setRenews]    = useState(false);
  const [saving, setSaving]         = useState(false);

  // Composto
  const [isComposite, setIsComposite]         = useState(false);
  const [compositeSalePrice, setCompSalePrice] = useState('');
  const [ingredients, setIngredients]         = useState<Ingredient[]>([]);

  // Picker de ingrediente
  const [ingPickerVisible, setIngPickerVisible] = useState(false);
  const [ingPickerProduct, setIngPickerProduct] = useState<Product | null>(null);
  const [ingPickerQty, setIngPickerQty]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setProducts(await getProducts()); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => {
    setEditing(null);
    setName(''); setImageUri(null); setRenews(false);
    setIsComposite(false); setCompSalePrice(''); setIngredients([]);
    setModal(true);
  };
  const openEdit = async (p: Product) => {
    setEditing(p);
    setName(p.name); setImageUri(p.image_uri); setRenews(p.renews_stock === 1);
    setIsComposite(p.is_composite === 1);
    setCompSalePrice(p.composite_sale_price != null ? String(p.composite_sale_price) : '');
    if (p.is_composite === 1) {
      const ings = await getIngredients(p.id);
      setIngredients(ings);
    } else {
      setIngredients([]);
    }
    setModal(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Informe o nome do produto.'); return; }
    if (isComposite) {
      const sp = parseFloat(compositeSalePrice);
      if (!sp || sp <= 0) { Alert.alert('Atenção', 'Informe o preço de venda do composto.'); return; }
      if (ingredients.length === 0) { Alert.alert('Atenção', 'Adicione ao menos um ingrediente.'); return; }
    }
    setSaving(true);
    try {
      const sp = isComposite ? parseFloat(compositeSalePrice) : null;
      let productId: number;
      if (editing) {
        await updateProduct(editing.id, name.trim(), imageUri, renewsStock, isComposite, sp);
        productId = editing.id;
      } else {
        const result = await createProduct(name.trim(), imageUri, renewsStock, isComposite, sp);
        productId = result.lastInsertRowId;
      }
      if (isComposite) {
        await saveIngredients(productId, ingredients.map(i => ({ ingredientId: i.ingredient_id, quantity: i.quantity })));
      } else {
        await saveIngredients(productId, []); // remove ingredientes se produto deixou de ser composto
      }
      setModal(false);
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = (p: Product) => {
    Alert.alert('Excluir produto', `Deseja excluir "${p.name}"?\nTodos os dados de estoque serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteProduct(p.id); await load(); } },
    ]);
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.card}>
              {item.image_uri ? (
                <Image source={{ uri: item.image_uri }} style={s.cardImg} />
              ) : (
                <View style={[s.cardImg, s.imgPlaceholder]}>
                  <Ionicons name="wine-outline" size={32} color={t.border} />
                </View>
              )}
              <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
              {item.renews_stock === 1 && (
                <View style={s.renewsBadge}>
                  <Ionicons name="refresh" size={10} color={GOLD} />
                  <Text style={s.renewsText}>Renova estoque</Text>
                </View>
              )}
              {item.is_composite === 1 && (
                <View style={[s.renewsBadge, { borderColor: t.sub }]}>
                  <Ionicons name="layers-outline" size={10} color={t.sub} />
                  <Text style={[s.renewsText, { color: t.sub }]}>Composto</Text>
                </View>
              )}
              <View style={s.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={s.btnIcon}>
                  <Ionicons name="pencil" size={18} color={GOLD} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={s.btnIcon}>
                  <Ionicons name="trash" size={18} color={t.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="wine-outline" size={64} color={t.border} />
              <Text style={s.emptyText}>Nenhum produto cadastrado</Text>
              <Text style={s.emptyHint}>Toque em + para adicionar</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={s.fab} onPress={openCreate}>
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{editing ? 'Editar Produto' : 'Novo Produto'}</Text>

            <TouchableOpacity style={s.imagePicker} onPress={pickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={s.imagePreview} />
              ) : (
                <View style={s.imagePlaceholderLarge}>
                  <Ionicons name="camera" size={36} color={t.sub} />
                  <Text style={s.imageHint}>Toque para adicionar foto</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={s.input}
              placeholder="Nome do produto"
              placeholderTextColor={t.placeholder}
              value={name}
              onChangeText={setName}
              maxLength={100}
            />

            {/* Renova estoque toggle */}
            <View style={s.switchRow}>
              <View style={s.switchInfo}>
                <Text style={s.switchLabel}>Renova estoque</Text>
                <Text style={s.switchHint}>
                  Adiciona automaticamente à lista de compras quando o estoque zerar
                </Text>
              </View>
              <Switch
                value={renewsStock}
                onValueChange={setRenews}
                trackColor={{ false: t.border, true: GOLD }}
                thumbColor={renewsStock ? '#000' : t.sub}
              />
            </View>

            {/* Seção de produto composto */}
            <View style={s.switchRow}>
              <View style={s.switchInfo}>
                <Text style={s.switchLabel}>É um produto composto?</Text>
                <Text style={s.switchHint}>Combo que deduz estoque de outros produtos ao ser vendido</Text>
              </View>
              <Switch
                value={isComposite}
                onValueChange={v => { setIsComposite(v); if (!v) setIngredients([]); }}
                trackColor={{ false: t.border, true: GOLD }}
                thumbColor={isComposite ? '#000' : t.sub}
              />
            </View>

            {isComposite && (
              <>
                <TextInput
                  style={s.input}
                  placeholder="Preço de venda (R$)"
                  placeholderTextColor={t.placeholder}
                  value={compositeSalePrice}
                  onChangeText={setCompSalePrice}
                  keyboardType="decimal-pad"
                />

                <Text style={s.ingTitle}>Ingredientes</Text>
                {ingredients.map((ing, idx) => (
                  <View key={idx} style={s.ingRow}>
                    <Text style={s.ingName} numberOfLines={1}>{ing.ingredient_name}</Text>
                    <Text style={s.ingQty}>{ing.quantity} un</Text>
                    <TouchableOpacity onPress={() => setIngredients(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="close-circle" size={18} color={t.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={s.addIngBtn} onPress={() => {
                  setIngPickerProduct(null); setIngPickerQty(''); setIngPickerVisible(true);
                }}>
                  <Ionicons name="add-circle-outline" size={16} color={GOLD} />
                  <Text style={s.addIngBtnText}>Adicionar ingrediente</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setModal(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleSave} disabled={saving}>
                <Text style={s.btnSaveText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Picker de ingrediente ── */}
      <Modal visible={ingPickerVisible} animationType="slide" transparent
        onRequestClose={() => setIngPickerVisible(false)}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '75%' }]}>
            <Text style={s.sheetTitle}>Adicionar Ingrediente</Text>

            <Text style={[s.switchHint, { marginBottom: 8 }]}>Selecione um produto:</Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {products
                .filter(p => p.is_composite === 0 && p.id !== editing?.id)
                .filter(p => !ingredients.some(i => i.ingredient_id === p.id))
                .map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.ingPickerItem, ingPickerProduct?.id === p.id && s.ingPickerItemSelected]}
                    onPress={() => setIngPickerProduct(p)}
                  >
                    {p.image_uri ? (
                      <Image source={{ uri: p.image_uri }} style={s.ingPickerImg} />
                    ) : (
                      <View style={[s.ingPickerImg, { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="wine-outline" size={14} color={t.border} />
                      </View>
                    )}
                    <Text style={s.ingPickerName} numberOfLines={1}>{p.name}</Text>
                    {ingPickerProduct?.id === p.id && (
                      <Ionicons name="checkmark-circle" size={18} color={GOLD} />
                    )}
                  </TouchableOpacity>
                ))
              }
            </ScrollView>

            {ingPickerProduct && (
              <>
                <Text style={[s.switchHint, { marginTop: 12, marginBottom: 4 }]}>Quantidade por unidade do composto:</Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex: 2"
                  placeholderTextColor={t.placeholder}
                  value={ingPickerQty}
                  onChangeText={setIngPickerQty}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setIngPickerVisible(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnSave, (!ingPickerProduct || !ingPickerQty) && { opacity: 0.4 }]}
                disabled={!ingPickerProduct || !ingPickerQty}
                onPress={() => {
                  const qty = parseFloat(ingPickerQty);
                  if (!qty || qty <= 0) { Alert.alert('Atenção', 'Quantidade inválida.'); return; }
                  if (!ingPickerProduct) return;
                  setIngredients(prev => [...prev, {
                    id: 0,
                    product_id: editing?.id ?? 0,
                    ingredient_id: ingPickerProduct.id,
                    ingredient_name: ingPickerProduct.name,
                    quantity: qty,
                  }]);
                  setIngPickerVisible(false);
                }}
              >
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
    container:    { flex: 1, backgroundColor: t.bg },
    list:         { padding: 12 },
    row:          { justifyContent: 'space-between' },
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 12,
      marginBottom: 12, width: '48%', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    cardImg:          { width: 80, height: 80, borderRadius: 8, marginBottom: 8 },
    imgPlaceholder:   { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    cardName:         { fontSize: 14, fontWeight: '600', textAlign: 'center', color: t.text, marginBottom: 4 },
    renewsBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: t.badge, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
      marginBottom: 6, borderWidth: 1, borderColor: GOLD,
    },
    renewsText:   { fontSize: 10, color: GOLD, fontWeight: '600' },
    cardActions:  { flexDirection: 'row', gap: 12 },
    btnIcon:      { padding: 6 },
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
      padding: 24, paddingBottom: 40,
    },
    sheetTitle:   { fontSize: 18, fontWeight: 'bold', color: t.text, marginBottom: 16 },
    imagePicker:  { alignSelf: 'center', marginBottom: 16 },
    imagePreview: { width: 120, height: 120, borderRadius: 12 },
    imagePlaceholderLarge: {
      width: 120, height: 120, borderRadius: 12, backgroundColor: t.badge,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: t.border, borderStyle: 'dashed',
    },
    imageHint:    { fontSize: 11, color: t.sub, marginTop: 4 },
    input: {
      borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.inputBg,
      padding: 12, fontSize: 16, color: t.text, marginBottom: 16,
    },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 20, padding: 14, backgroundColor: t.badge,
      borderRadius: 12, borderWidth: 1, borderColor: t.border,
    },
    switchInfo:   { flex: 1, marginRight: 12 },
    switchLabel:  { fontSize: 15, fontWeight: '600', color: t.text, marginBottom: 2 },
    switchHint:   { fontSize: 11, color: t.sub },
    btnRow:       { flexDirection: 'row', gap: 12 },
    btn:          { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    btnCancel:    { backgroundColor: t.badge },
    btnCancelText: { color: t.sub, fontWeight: '600' },
    btnSave:      { backgroundColor: GOLD },
    btnSaveText:  { color: '#000', fontWeight: '700' },
    ingTitle:     { fontSize: 13, fontWeight: '700', color: t.text, marginBottom: 8, marginTop: 4 },
    ingRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: t.badge, borderRadius: 8, padding: 8,
      marginBottom: 6, borderWidth: 1, borderColor: t.border,
    },
    ingName:      { flex: 1, fontSize: 13, color: t.text, fontWeight: '500' },
    ingQty:       { fontSize: 13, color: t.sub },
    addIngBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      padding: 10, borderRadius: 8, borderWidth: 1,
      borderColor: GOLD, borderStyle: 'dashed', marginBottom: 16, justifyContent: 'center',
    },
    addIngBtnText: { fontSize: 13, color: GOLD, fontWeight: '600' },
    ingPickerItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
      borderRadius: 8, marginBottom: 4, backgroundColor: t.badge,
      borderWidth: 1, borderColor: t.border,
    },
    ingPickerItemSelected: { borderColor: GOLD, backgroundColor: t.optionSelectedBg },
    ingPickerImg:  { width: 32, height: 32, borderRadius: 6 },
    ingPickerName: { flex: 1, fontSize: 13, color: t.text, fontWeight: '500' },
  });
}
