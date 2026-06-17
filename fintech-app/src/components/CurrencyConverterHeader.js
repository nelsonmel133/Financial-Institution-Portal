import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFinancial } from '../context/FinancialContext';

const CURRENCIES = ['USD', 'ZWG', 'ZAR'];

const CURRENCY_META = {
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  ZWG: { symbol: 'ZWG', name: 'Zimbabwe Gold', flag: '🇿🇼' },
  ZAR: { symbol: 'R', name: 'South African Rand', flag: '🇿🇦' },
};

const COLORS = {
  navy: '#0B1437',
  navyLight: '#111D4A',
  border: '#1E3060',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.12)',
  emerald: '#10B981',
  amber: '#F59E0B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
};

function formatVal(amount, currency) {
  const sym = { USD: '$', ZWG: 'ZWG ', ZAR: 'R' }[currency] || '';
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CurrencyConverterHeader() {
  const { baseCurrency, setBaseCurrency, exchangeRates, updateExchangeRate } = useFinancial();
  const [ratesModalVisible, setRatesModalVisible] = useState(false);
  const [inputAmount, setInputAmount] = useState('1000');
  const [editingRates, setEditingRates] = useState({
    USD: String(exchangeRates.USD),
    ZWG: String(exchangeRates.ZWG),
    ZAR: String(exchangeRates.ZAR),
  });

  const baseAmount = parseFloat(inputAmount) || 0;

  // Convert baseAmount (in baseCurrency) to each other currency
  function convertedValue(toCurrency) {
    const amountInUSD = baseAmount / exchangeRates[baseCurrency];
    return amountInUSD * exchangeRates[toCurrency];
  }

  function saveRates() {
    Object.keys(editingRates).forEach((cur) => {
      const val = parseFloat(editingRates[cur]);
      if (!isNaN(val) && val > 0) updateExchangeRate(cur, val);
    });
    setRatesModalVisible(false);
  }

  return (
    <>
      <View style={styles.container}>
        {/* Left: base amount input */}
        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>BASE AMOUNT</Text>
          <View style={styles.inputRow}>
            <Text style={styles.inputCurrencySymbol}>
              {CURRENCY_META[baseCurrency].symbol}
            </Text>
            <TextInput
              style={styles.amountInput}
              value={inputAmount}
              onChangeText={setInputAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.textMuted}
              selectTextOnFocus
            />
          </View>
        </View>

        <Feather name="arrow-right" size={14} color={COLORS.textMuted} style={{ marginHorizontal: 4 }} />

        {/* Currency conversion values */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.convRow}>
          {CURRENCIES.map((cur) => {
            const isBase = cur === baseCurrency;
            return (
              <TouchableOpacity
                key={cur}
                style={[styles.convCell, isBase && styles.convCellActive]}
                onPress={() => setBaseCurrency(cur)}
                activeOpacity={0.75}
              >
                <Text style={styles.convFlag}>{CURRENCY_META[cur].flag}</Text>
                <Text style={[styles.convCurrency, isBase && styles.convCurrencyActive]}>{cur}</Text>
                <Text style={[styles.convValue, isBase && styles.convValueActive]} numberOfLines={1}>
                  {formatVal(convertedValue(cur), cur)}
                </Text>
                {isBase && (
                  <View style={styles.basePill}>
                    <Text style={styles.basePillText}>BASE</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Rates edit button */}
        <TouchableOpacity
          style={styles.ratesButton}
          onPress={() => {
            setEditingRates({
              USD: String(exchangeRates.USD),
              ZWG: String(exchangeRates.ZWG),
              ZAR: String(exchangeRates.ZAR),
            });
            setRatesModalVisible(true);
          }}
          activeOpacity={0.75}
        >
          <Feather name="sliders" size={14} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      {/* Rate editor modal */}
      <Modal
        visible={ratesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRatesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Exchange Rate Settings</Text>
              <TouchableOpacity onPress={() => setRatesModalVisible(false)}>
                <Feather name="x" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              All rates are expressed as units per 1 USD (base reference)
            </Text>

            {CURRENCIES.map((cur) => (
              <View key={cur} style={styles.rateRow}>
                <View style={styles.rateRowLeft}>
                  <Text style={styles.rateFlag}>{CURRENCY_META[cur].flag}</Text>
                  <View>
                    <Text style={styles.rateCurCode}>{cur}</Text>
                    <Text style={styles.rateCurName}>{CURRENCY_META[cur].name}</Text>
                  </View>
                </View>
                <View style={styles.rateInputWrapper}>
                  <Text style={styles.ratePrefix}>1 USD =</Text>
                  <TextInput
                    style={[styles.rateInput, cur === 'USD' && styles.rateInputDisabled]}
                    value={editingRates[cur]}
                    onChangeText={(v) => setEditingRates((prev) => ({ ...prev, [cur]: v }))}
                    keyboardType="decimal-pad"
                    editable={cur !== 'USD'}
                    selectTextOnFocus
                  />
                  <Text style={styles.rateSuffix}>{cur}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.saveButton} onPress={saveRates} activeOpacity={0.8}>
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Apply Rates</Text>
            </TouchableOpacity>

            <Text style={styles.modalNote}>
              Rate changes recalculate all dashboard values instantly.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111D4A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E3060',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  inputBlock: {
    minWidth: 90,
  },
  inputLabel: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1437',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#1E3060',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  inputCurrencySymbol: {
    color: '#94A3B8',
    fontSize: 11,
    marginRight: 3,
    fontWeight: '600',
  },
  amountInput: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
    width: 62,
  },
  convRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flex: 1,
  },
  convCell: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E3060',
    backgroundColor: '#0B1437',
    minWidth: 88,
  },
  convCellActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  convFlag: {
    fontSize: 10,
    marginBottom: 1,
  },
  convCurrency: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  convCurrencyActive: {
    color: '#3B82F6',
  },
  convValue: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '700',
  },
  convValueActive: {
    color: '#F1F5F9',
  },
  basePill: {
    marginTop: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  basePillText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ratesButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: '#1E3060',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#111D4A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E3060',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 20,
    lineHeight: 17,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rateFlag: {
    fontSize: 22,
  },
  rateCurCode: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  rateCurName: {
    color: '#94A3B8',
    fontSize: 11,
  },
  rateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratePrefix: {
    color: '#475569',
    fontSize: 11,
  },
  rateInput: {
    backgroundColor: '#0B1437',
    borderWidth: 1,
    borderColor: '#1E3060',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
    width: 72,
    textAlign: 'right',
  },
  rateInputDisabled: {
    color: '#475569',
  },
  rateSuffix: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    width: 28,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalNote: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});
