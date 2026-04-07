import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  Image, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProducts, createProduct, updateProduct, deleteProduct, Product } from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

export default function ProdutosScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Product | null>(null);
  const [name, setName]         = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setProducts(await getProducts()); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => { setEditing(null); setName(''); setImageUri(null); setModal(true); };
  const openEdit   = (p: Product) => { setEditing(p); setName(p.name); setImageUri(p.image_uri); setModal(true); };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Informe o nome do produto.'); return; }
    setSaving(true);
    try {
      if (editing) await updateProduct(editing.id, name.trim(), imageUri);
      else         await createProduct(name.trim(), imageUri);
      setModal(false);
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = (p: Product) => {
    Alert.alert(
      'Excluir produto',
      `Deseja excluir "${p.name}"?\nTodos os dados de estoque serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive',
          onPress: async () => { await deleteProduct(p.id); await load(); } },
      ],
    );
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
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: t.bg },
    list:        { padding: 12 },
    row:         { justifyContent: 'space-between' },
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 12,
      marginBottom: 12, width: '48%', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    cardImg:        { width: 80, height: 80, borderRadius: 8, marginBottom: 8 },
    imgPlaceholder: { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    cardName:       { fontSize: 14, fontWeight: '600', textAlign: 'center', color: t.text, marginBottom: 8 },
    cardActions:    { flexDirection: 'row', gap: 12 },
    btnIcon:        { padding: 6 },
    empty:          { alignItems: 'center', marginTop: 80, gap: 8 },
    emptyText:      { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint:      { fontSize: 13, color: t.placeholder },
    fab: {
      position: 'absolute', right: 20, bottom: 20,
      backgroundColor: GOLD, width: 56, height: 56,
      borderRadius: 28, alignItems: 'center', justifyContent: 'center',
      elevation: 5,
    },
    overlay:     { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40,
    },
    sheetTitle:  { fontSize: 18, fontWeight: 'bold', color: t.text, marginBottom: 16 },
    imagePicker: { alignSelf: 'center', marginBottom: 16 },
    imagePreview: { width: 120, height: 120, borderRadius: 12 },
    imagePlaceholderLarge: {
      width: 120, height: 120, borderRadius: 12, backgroundColor: t.badge,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: t.border, borderStyle: 'dashed',
    },
    imageHint:   { fontSize: 11, color: t.sub, marginTop: 4 },
    input: {
      borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.inputBg,
      padding: 12, fontSize: 16, color: t.text, marginBottom: 16,
    },
    btnRow:      { flexDirection: 'row', gap: 12 },
    btn:         { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    btnCancel:   { backgroundColor: t.badge },
    btnCancelText: { color: t.sub, fontWeight: '600' },
    btnSave:     { backgroundColor: GOLD },
    btnSaveText: { color: '#000', fontWeight: '700' },
  });
}
