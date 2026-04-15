import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPaymentMethods, createPaymentMethod, updatePaymentMethod,
  deletePaymentMethod, PaymentMethod,
} from '../src/database/db';
import { useTheme, GOLD, Theme } from '../src/theme';

export default function PagamentosScreen() {
  const t      = useTheme();
  const s      = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();

  const [methods, setMethods]   = useState<PaymentMethod[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<PaymentMethod | null>(null);
  const [name, setName]         = useState('');
  const [fee, setFee]           = useState('');
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMethods(await getPaymentMethods()); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => { setEditing(null); setName(''); setFee(''); setModal(true); };
  const openEdit   = (pm: PaymentMethod) => {
    setEditing(pm); setName(pm.name); setFee(String(pm.fee_pct)); setModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Informe o nome.'); return; }
    const feePct = parseFloat(fee);
    if (isNaN(feePct) || feePct < 0 || feePct > 100) {
      Alert.alert('Atenção', 'Taxa deve ser entre 0 e 100.'); return;
    }
    setSaving(true);
    try {
      if (editing) await updatePaymentMethod(editing.id, name.trim(), feePct);
      else         await createPaymentMethod(name.trim(), feePct);
      setModal(false);
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = (pm: PaymentMethod) => {
    Alert.alert('Excluir', `Excluir "${pm.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive',
        onPress: async () => { await deletePaymentMethod(pm.id); await load(); } },
    ]);
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom', 'top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={GOLD} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Formas de Pagamento</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={methods}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardLeft}>
                <View style={s.iconBox}>
                  <Ionicons name="card" size={22} color={GOLD} />
                </View>
                <View>
                  <Text style={s.cardName}>{item.name}</Text>
                  <Text style={s.cardFee}>Taxa: {item.fee_pct.toFixed(2)}%</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={s.actionBtn}>
                  <Ionicons name="pencil" size={18} color={GOLD} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={s.actionBtn}>
                  <Ionicons name="trash" size={18} color={t.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="card-outline" size={64} color={t.border} />
              <Text style={s.emptyText}>Nenhuma forma de pagamento</Text>
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
            <Text style={s.sheetTitle}>
              {editing ? 'Editar Pagamento' : 'Nova Forma de Pagamento'}
            </Text>

            <Text style={s.fieldLabel}>Nome</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: Pix, Débito, Crédito à vista…"
              placeholderTextColor={t.placeholder}
              value={name}
              onChangeText={setName}
              maxLength={60}
            />

            <Text style={s.fieldLabel}>Taxa da transação (%)</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: 1.99"
              placeholderTextColor={t.placeholder}
              value={fee}
              onChangeText={setFee}
              keyboardType="decimal-pad"
            />
            <Text style={s.feeHint}>
              Informe o percentual cobrado pela maquininha/gateway para este método.
            </Text>

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
    container:    { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: t.headerBg, paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.3)',
    },
    backBtn:      { padding: 4 },
    headerTitle:  { fontSize: 17, fontWeight: 'bold', color: GOLD },
    list:         { padding: 12, paddingBottom: 80 },
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 14,
      marginBottom: 10, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    cardLeft:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: {
      width: 44, height: 44, borderRadius: 10, backgroundColor: t.badge,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GOLD,
    },
    cardName:     { fontSize: 15, fontWeight: '700', color: t.text },
    cardFee:      { fontSize: 13, color: t.sub, marginTop: 2 },
    cardActions:  { flexDirection: 'row', gap: 10 },
    actionBtn:    { padding: 8 },
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
    sheetTitle:   { fontSize: 18, fontWeight: 'bold', color: t.text, marginBottom: 20 },
    fieldLabel:   { fontSize: 13, color: t.sub, fontWeight: '600', marginBottom: 6 },
    input: {
      borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.inputBg,
      padding: 12, fontSize: 16, color: t.text, marginBottom: 6,
    },
    feeHint:      { fontSize: 11, color: t.placeholder, marginBottom: 20 },
    btnRow:       { flexDirection: 'row', gap: 12 },
    btn:          { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    btnCancel:    { backgroundColor: t.badge },
    btnCancelText: { color: t.sub, fontWeight: '600' },
    btnSave:      { backgroundColor: GOLD },
    btnSaveText:  { color: '#000', fontWeight: '700' },
  });
}
