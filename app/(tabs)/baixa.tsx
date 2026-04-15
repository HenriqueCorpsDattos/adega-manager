import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, Modal, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getStockLots, getPaymentMethods, confirmOrder,
  StockLot, PaymentMethod, CartItem,
} from '../../src/database/db';
import { useTheme, GOLD, Theme } from '../../src/theme';

const fmt     = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  const [groups, setGroups]               = useState<ProductGroup[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');

  // Cart
  const [cart, setCart]       = useState<CartItem[]>([]);
  const [cartVisible, setCartVisible] = useState(false);

  // Lot picker
  const [lotModal, setLotModal]           = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [selectedLot, setSelectedLot]     = useState<StockLot | null>(null);
  const [qtyInput, setQtyInput]           = useState('');
  const [notesInput, setNotesInput]       = useState('');

  // Checkout
  const [checkoutModal, setCheckoutModal]   = useState(false);
  const [selectedPM, setSelectedPM]         = useState<PaymentMethod | null>(null);
  const [orderNotes, setOrderNotes]         = useState('');
  const [saving, setSaving]                 = useState(false);

  // Edit cart item
  const [editIdx, setEditIdx]   = useState<number | null>(null);
  const [editQty, setEditQty]   = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editModal, setEditModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lots, pms] = await Promise.all([getStockLots(), getPaymentMethods()]);
      setGroups(groupLots(lots));
      setPaymentMethods(pms);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => groups.filter(g => g.product_name.toLowerCase().includes(search.toLowerCase())),
    [groups, search],
  );

  const cartTotal = cart.reduce((s, i) => s + i.unit_sale_price * i.quantity, 0);
  const feePct    = selectedPM?.fee_pct ?? 0;
  const feeValue  = cartTotal * (feePct / 100);
  const netValue  = cartTotal - feeValue;

  // ── Add to cart ──────────────────────────────────────────────────────────
  const openLotModal = (g: ProductGroup) => {
    setSelectedGroup(g);
    setSelectedLot(null);
    setQtyInput('');
    setNotesInput('');
    setLotModal(true);
  };

  const handleAddToCart = () => {
    if (!selectedLot || !selectedGroup) return;
    const qty = parseFloat(qtyInput);
    if (!qty || qty <= 0) { Alert.alert('Atenção', 'Informe uma quantidade válida.'); return; }

    // Check available considering already-in-cart for the same lot
    const inCart = cart.filter(i => i.entry_id === selectedLot.entry_id)
      .reduce((s, i) => s + i.quantity, 0);
    if (qty + inCart > selectedLot.remaining_quantity) {
      Alert.alert('Estoque insuficiente', `Disponível neste lote: ${selectedLot.remaining_quantity - inCart} un`);
      return;
    }

    const newItem: CartItem = {
      product_id:      selectedLot.product_id,
      product_name:    selectedLot.product_name,
      product_image:   selectedLot.product_image,
      entry_id:        selectedLot.entry_id,
      lot_date:        selectedLot.entry_date,
      quantity:        qty,
      unit_sale_price: selectedLot.sale_price,
      purchase_price:  selectedLot.purchase_price,
      margin_pct:      selectedLot.margin_pct,
      notes:           notesInput,
    };
    setCart(prev => [...prev, newItem]);
    setLotModal(false);
  };

  // ── Edit cart item ────────────────────────────────────────────────────────
  const openEditCart = (idx: number) => {
    setEditIdx(idx);
    setEditQty(String(cart[idx].quantity));
    setEditNotes(cart[idx].notes);
    setEditModal(true);
  };

  const handleSaveEdit = () => {
    if (editIdx === null) return;
    const qty = parseFloat(editQty);
    if (!qty || qty <= 0) { Alert.alert('Atenção', 'Quantidade inválida.'); return; }
    setCart(prev => prev.map((item, i) =>
      i === editIdx ? { ...item, quantity: qty, notes: editNotes } : item,
    ));
    setEditModal(false);
  };

  const removeFromCart = (idx: number) => {
    Alert.alert('Remover', 'Remover este item do carrinho?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => setCart(prev => prev.filter((_, i) => i !== idx)) },
    ]);
  };

  // ── Confirm order ─────────────────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    setSaving(true);
    try {
      await confirmOrder(cart, selectedPM?.id ?? null, orderNotes);
      setCart([]);
      setSelectedPM(null);
      setOrderNotes('');
      setCheckoutModal(false);
      Alert.alert('Pedido confirmado!', 'O pedido foi registrado com sucesso.');
      await load();
    } finally { setSaving(false); }
  };

  if (loading) return <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Search bar */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={16} color={t.sub} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar produto…"
          placeholderTextColor={t.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={t.sub} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={g => String(g.product_id)}
        contentContainerStyle={s.list}
        renderItem={({ item: g }) => (
          <TouchableOpacity style={s.card} onPress={() => openLotModal(g)}>
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
            <Ionicons name="add-circle-outline" size={26} color={GOLD} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="arrow-up-circle-outline" size={64} color={t.border} />
            <Text style={s.emptyText}>{search ? 'Nenhum produto encontrado' : 'Estoque vazio'}</Text>
          </View>
        }
      />

      {/* Cart FAB */}
      {cart.length > 0 && (
        <TouchableOpacity style={s.cartFab} onPress={() => setCartVisible(true)}>
          <Ionicons name="cart" size={24} color="#000" />
          <View style={s.cartBadge}>
            <Text style={s.cartBadgeText}>{cart.length}</Text>
          </View>
          <Text style={s.cartFabText}>{fmt(cartTotal)}</Text>
        </TouchableOpacity>
      )}

      {/* ── Lot picker modal ── */}
      <Modal visible={lotModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{selectedGroup?.product_name}</Text>
            <Text style={s.sectionLabel}>Selecione o lote:</Text>
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {selectedGroup?.lots.map(lot => (
                <TouchableOpacity
                  key={lot.entry_id}
                  style={[s.lotItem, selectedLot?.entry_id === lot.entry_id && s.lotItemSelected]}
                  onPress={() => setSelectedLot(lot)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.lotDate}>Lote {fmtDate(lot.entry_date)}</Text>
                    <Text style={s.lotDetail}>
                      {lot.remaining_quantity} un disponíveis · Venda {fmt(lot.sale_price)}
                    </Text>
                  </View>
                  {selectedLot?.entry_id === lot.entry_id && (
                    <Ionicons name="checkmark-circle" size={22} color={GOLD} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedLot && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 12 }]}>Quantidade:</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor={t.placeholder}
                  value={qtyInput}
                  onChangeText={setQtyInput}
                  keyboardType="decimal-pad"
                />
                <Text style={s.sectionLabel}>Observação (opcional):</Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex: venda balcão…"
                  placeholderTextColor={t.placeholder}
                  value={notesInput}
                  onChangeText={setNotesInput}
                />
              </>
            )}

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setLotModal(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              {selectedLot && (
                <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleAddToCart}>
                  <Text style={s.btnSaveText}>Adicionar ao carrinho</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Cart modal ── */}
      <Modal visible={cartVisible} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '90%' }]}>
            <View style={s.cartHeader}>
              <Text style={s.sheetTitle}>Carrinho</Text>
              <TouchableOpacity onPress={() => setCartVisible(false)}>
                <Ionicons name="close" size={24} color={t.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {cart.map((item, idx) => (
                <View key={idx} style={s.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cartItemName}>{item.product_name}</Text>
                    <Text style={s.cartItemDetail}>
                      Lote {fmtDate(item.lot_date)} · {item.quantity} un · {fmt(item.unit_sale_price)}/un
                    </Text>
                    {item.notes ? <Text style={s.cartItemNotes}>{item.notes}</Text> : null}
                  </View>
                  <Text style={s.cartItemTotal}>{fmt(item.unit_sale_price * item.quantity)}</Text>
                  <TouchableOpacity onPress={() => openEditCart(idx)} style={s.cartAction}>
                    <Ionicons name="pencil" size={16} color={GOLD} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeFromCart(idx)} style={s.cartAction}>
                    <Ionicons name="trash" size={16} color={t.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={s.cartTotals}>
              <View style={s.cartTotalRow}>
                <Text style={s.cartTotalLabel}>Subtotal</Text>
                <Text style={s.cartTotalVal}>{fmt(cartTotal)}</Text>
              </View>
              {selectedPM && (
                <View style={s.cartTotalRow}>
                  <Text style={s.cartTotalLabel}>Taxa {selectedPM.name} ({feePct}%)</Text>
                  <Text style={[s.cartTotalVal, { color: t.danger }]}>- {fmt(feeValue)}</Text>
                </View>
              )}
              <View style={[s.cartTotalRow, s.cartNetRow]}>
                <Text style={s.cartNetLabel}>Total líquido</Text>
                <Text style={s.cartNetVal}>{fmt(netValue)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.checkoutBtn}
              onPress={() => { setCartVisible(false); setCheckoutModal(true); }}
            >
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={s.checkoutBtnText}>Finalizar pedido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Checkout modal ── */}
      <Modal visible={checkoutModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Finalizar Pedido</Text>

            <Text style={s.sectionLabel}>Forma de pagamento:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pmList}>
              <TouchableOpacity
                style={[s.pmChip, selectedPM === null && s.pmChipSelected]}
                onPress={() => setSelectedPM(null)}
              >
                <Text style={[s.pmChipText, selectedPM === null && s.pmChipTextSelected]}>
                  Sem registro
                </Text>
              </TouchableOpacity>
              {paymentMethods.map(pm => (
                <TouchableOpacity
                  key={pm.id}
                  style={[s.pmChip, selectedPM?.id === pm.id && s.pmChipSelected]}
                  onPress={() => setSelectedPM(pm)}
                >
                  <Text style={[s.pmChipText, selectedPM?.id === pm.id && s.pmChipTextSelected]}>
                    {pm.name} ({pm.fee_pct}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.sectionLabel}>Observação (opcional):</Text>
            <TextInput
              style={s.input}
              placeholder="Observação do pedido…"
              placeholderTextColor={t.placeholder}
              value={orderNotes}
              onChangeText={setOrderNotes}
            />

            <View style={s.checkoutSummary}>
              <View style={s.cartTotalRow}>
                <Text style={s.cartTotalLabel}>Total bruto</Text>
                <Text style={s.cartTotalVal}>{fmt(cartTotal)}</Text>
              </View>
              {selectedPM && (
                <View style={s.cartTotalRow}>
                  <Text style={s.cartTotalLabel}>Taxa ({feePct}%)</Text>
                  <Text style={[s.cartTotalVal, { color: t.danger }]}>- {fmt(feeValue)}</Text>
                </View>
              )}
              <View style={[s.cartTotalRow, s.cartNetRow]}>
                <Text style={s.cartNetLabel}>Total líquido</Text>
                <Text style={s.cartNetVal}>{fmt(netValue)}</Text>
              </View>
            </View>

            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setCheckoutModal(false)}>
                <Text style={s.btnCancelText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleConfirmOrder} disabled={saving}>
                <Text style={s.btnSaveText}>{saving ? 'Confirmando…' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit cart item modal ── */}
      <Modal visible={editModal} animationType="fade" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Editar Item</Text>
            <Text style={s.sectionLabel}>Quantidade:</Text>
            <TextInput
              style={s.input}
              value={editQty}
              onChangeText={setEditQty}
              keyboardType="decimal-pad"
              placeholderTextColor={t.placeholder}
            />
            <Text style={s.sectionLabel}>Observação:</Text>
            <TextInput
              style={s.input}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholderTextColor={t.placeholder}
            />
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setEditModal(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleSaveEdit}>
                <Text style={s.btnSaveText}>Salvar</Text>
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
    searchBar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.card, marginHorizontal: 12, marginTop: 10, marginBottom: 4,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: t.border,
    },
    searchInput:  { flex: 1, fontSize: 15, color: t.text },
    list:         { padding: 12, paddingTop: 4, paddingBottom: 100 },
    card: {
      backgroundColor: t.card, borderRadius: 12, padding: 12,
      marginBottom: 8, flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: t.border,
    },
    img:          { width: 52, height: 52, borderRadius: 8, marginRight: 12 },
    imgPlaceholder: { backgroundColor: t.badge, alignItems: 'center', justifyContent: 'center' },
    cardInfo:     { flex: 1 },
    productName:  { fontSize: 15, fontWeight: '600', color: t.text, marginBottom: 3 },
    stockText:    { fontSize: 12, color: t.sub },
    empty:        { alignItems: 'center', marginTop: 80, gap: 8 },
    emptyText:    { fontSize: 16, color: t.sub, fontWeight: '500' },
    cartFab: {
      position: 'absolute', right: 16, bottom: 16,
      backgroundColor: GOLD, borderRadius: 28, paddingHorizontal: 16, paddingVertical: 12,
      flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6,
    },
    cartBadge: {
      backgroundColor: '#000', borderRadius: 10, minWidth: 20,
      height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    },
    cartBadgeText:  { color: GOLD, fontSize: 11, fontWeight: 'bold' },
    cartFabText:    { color: '#000', fontWeight: 'bold', fontSize: 14 },
    overlay:        { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.sheetBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 36,
    },
    sheetTitle:   { fontSize: 18, fontWeight: 'bold', color: t.text, marginBottom: 12 },
    sectionLabel: { fontSize: 12, color: t.sub, fontWeight: '600', marginBottom: 6 },
    lotItem: {
      flexDirection: 'row', alignItems: 'center', padding: 12,
      borderRadius: 10, marginBottom: 6, backgroundColor: t.optionBg,
      borderWidth: 1, borderColor: t.border,
    },
    lotItemSelected: { backgroundColor: t.optionSelectedBg, borderColor: GOLD },
    lotDate:      { fontSize: 14, fontWeight: '700', color: t.text },
    lotDetail:    { fontSize: 12, color: t.sub, marginTop: 2 },
    input: {
      borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.inputBg,
      padding: 12, fontSize: 15, color: t.text, marginBottom: 12,
    },
    btnRow:       { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn:          { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    btnCancel:    { backgroundColor: t.badge },
    btnCancelText: { color: t.sub, fontWeight: '600' },
    btnSave:      { backgroundColor: GOLD },
    btnSaveText:  { color: '#000', fontWeight: '700' },
    cartHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cartItem: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: t.border, gap: 6,
    },
    cartItemName:   { fontSize: 14, fontWeight: '600', color: t.text },
    cartItemDetail: { fontSize: 12, color: t.sub, marginTop: 1 },
    cartItemNotes:  { fontSize: 11, color: t.placeholder, fontStyle: 'italic' },
    cartItemTotal:  { fontSize: 13, fontWeight: '700', color: GOLD },
    cartAction:     { padding: 6 },
    cartTotals:    { paddingTop: 10, marginBottom: 12 },
    cartTotalRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    cartTotalLabel: { fontSize: 13, color: t.sub },
    cartTotalVal:   { fontSize: 13, fontWeight: '600', color: t.text },
    cartNetRow:    { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8, marginTop: 4 },
    cartNetLabel:  { fontSize: 15, fontWeight: '700', color: t.text },
    cartNetVal:    { fontSize: 15, fontWeight: '700', color: GOLD },
    checkoutBtn: {
      backgroundColor: GOLD, borderRadius: 12, padding: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    checkoutBtnText:  { color: '#000', fontWeight: 'bold', fontSize: 15 },
    pmList:           { marginBottom: 12 },
    pmChip: {
      borderWidth: 1, borderColor: t.border, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
      backgroundColor: t.badge,
    },
    pmChipSelected:   { backgroundColor: GOLD, borderColor: GOLD },
    pmChipText:       { fontSize: 13, color: t.sub, fontWeight: '600' },
    pmChipTextSelected: { color: '#000' },
    checkoutSummary:  { backgroundColor: t.badge, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: t.border },
  });
}
