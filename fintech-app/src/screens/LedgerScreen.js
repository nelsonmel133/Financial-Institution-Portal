import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinancial } from '../context/FinancialContext';

const COLORS = {
  navy: '#0B1437',
  navyLight: '#111D4A',
  border: '#1E3060',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.12)',
  emerald: '#10B981',
  emeraldDim: 'rgba(16,185,129,0.1)',
  amber: '#F59E0B',
  amberDim: 'rgba(245,158,11,0.1)',
  crimson: '#EF4444',
  crimsonDim: 'rgba(239,68,68,0.1)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
};

const CATEGORY_ICONS = {
  sales: 'shopping-bag',
  procurement: 'package',
  cash: 'dollar-sign',
  forex: 'refresh-cw',
  payroll: 'users',
  vault: 'archive',
  overhead: 'home',
  digital: 'smartphone',
};

const CATEGORY_COLORS = {
  sales: '#3B82F6',
  procurement: '#8B5CF6',
  cash: '#10B981',
  forex: '#F59E0B',
  payroll: '#06B6D4',
  vault: '#64748B',
  overhead: '#94A3B8',
  digital: '#EC4899',
};

const CURRENCIES = ['USD', 'ZWG', 'ZAR'];

function formatOriginal(amount, currency) {
  const sym = { USD: '$', ZWG: 'ZWG ', ZAR: 'R' }[currency] || '';
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function LedgerSummaryBand({ entries, convertToBase, formatCurrency }) {
  const totalIn = entries
    .filter((e) => e.type === 'inflow')
    .reduce((sum, e) => sum + convertToBase(e.originalAmount, e.originalCurrency), 0);
  const totalOut = entries
    .filter((e) => e.type === 'outflow')
    .reduce((sum, e) => sum + convertToBase(e.originalAmount, e.originalCurrency), 0);
  const net = totalIn - totalOut;

  return (
    <View style={styles.summaryBand}>
      <View style={styles.summaryCol}>
        <Text style={styles.summaryBandLabel}>Total Inflows</Text>
        <Text style={[styles.summaryBandValue, { color: COLORS.emerald }]}>{formatCurrency(totalIn)}</Text>
      </View>
      <View style={styles.summaryBandDivider} />
      <View style={styles.summaryCol}>
        <Text style={styles.summaryBandLabel}>Total Outflows</Text>
        <Text style={[styles.summaryBandValue, { color: COLORS.crimson }]}>{formatCurrency(totalOut)}</Text>
      </View>
      <View style={styles.summaryBandDivider} />
      <View style={styles.summaryCol}>
        <Text style={styles.summaryBandLabel}>Net Position</Text>
        <Text style={[styles.summaryBandValue, { color: net >= 0 ? COLORS.emerald : COLORS.crimson }]}>
          {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net))}
        </Text>
      </View>
    </View>
  );
}

function LedgerRow({ entry, convertToBase, formatCurrency, baseCurrency }) {
  const [expanded, setExpanded] = useState(false);
  const isInflow = entry.type === 'inflow';
  const convertedAmount = convertToBase(entry.originalAmount, entry.originalCurrency);
  const isSameCurrency = entry.originalCurrency === baseCurrency;
  const catColor = CATEGORY_COLORS[entry.category] || COLORS.textSecondary;
  const catIcon = CATEGORY_ICONS[entry.category] || 'circle';

  return (
    <TouchableOpacity
      style={[styles.ledgerRow, entry.flagged && styles.ledgerRowFlagged]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
    >
      {/* Left icon */}
      <View style={[styles.catIcon, { backgroundColor: catColor + '22' }]}>
        <Feather name={catIcon} size={13} color={catColor} />
      </View>

      {/* Center content */}
      <View style={styles.ledgerCenter}>
        <View style={styles.ledgerTopRow}>
          <Text style={styles.ledgerDesc} numberOfLines={expanded ? undefined : 1}>
            {entry.description}
          </Text>
          {entry.flagged && (
            <View style={styles.flagPill}>
              <Feather name="flag" size={9} color={COLORS.crimson} />
              <Text style={styles.flagPillText}>AML</Text>
            </View>
          )}
        </View>
        <View style={styles.ledgerMeta}>
          <Text style={styles.ledgerDate}>{formatDate(entry.date)}</Text>
          <Text style={styles.ledgerDot}>·</Text>
          <Text style={[styles.ledgerCat, { color: catColor }]}>
            {entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
          </Text>
          {!isSameCurrency && (
            <>
              <Text style={styles.ledgerDot}>·</Text>
              <Text style={styles.ledgerOriginal}>
                {formatOriginal(entry.originalAmount, entry.originalCurrency)}
              </Text>
            </>
          )}
        </View>

        {/* Expanded detail */}
        {expanded && (
          <View style={styles.expandedBlock}>
            <View style={styles.expandedRow}>
              <Text style={styles.expandedLabel}>Reference</Text>
              <Text style={styles.expandedRef}>{entry.ref}</Text>
            </View>
            {!isSameCurrency && (
              <View style={styles.expandedRow}>
                <Text style={styles.expandedLabel}>Original Currency</Text>
                <Text style={styles.expandedValue}>{entry.originalCurrency}</Text>
              </View>
            )}
            <View style={styles.expandedRow}>
              <Text style={styles.expandedLabel}>Original Amount</Text>
              <Text style={styles.expandedValue}>
                {formatOriginal(entry.originalAmount, entry.originalCurrency)}
              </Text>
            </View>
            {!isSameCurrency && (
              <View style={styles.expandedRow}>
                <Text style={styles.expandedLabel}>Converted ({baseCurrency})</Text>
                <Text style={[styles.expandedValue, { color: isInflow ? COLORS.emerald : COLORS.crimson }]}>
                  {formatCurrency(convertedAmount)}
                </Text>
              </View>
            )}
            {entry.flagged && (
              <TouchableOpacity
                style={styles.viewFlagBtn}
                onPress={() => Alert.alert('AML Flag', `This transaction (${entry.ref}) has been flagged for AML review. Navigate to the Compliance screen for full details.`)}
              >
                <Feather name="alert-triangle" size={12} color={COLORS.amber} />
                <Text style={styles.viewFlagBtnText}>View AML Flag Details</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Right: amount + chevron */}
      <View style={styles.ledgerRight}>
        <Text style={[styles.ledgerAmount, { color: isInflow ? COLORS.emerald : COLORS.crimson }]}>
          {isInflow ? '+' : '-'}{formatCurrency(convertedAmount)}
        </Text>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={COLORS.textMuted}
          style={{ marginTop: 4 }}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const { activeTenant, ledgerEntries, baseCurrency, convertToBase, formatCurrency } = useFinancial();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest');

  const filtered = useMemo(() => {
    let result = [...ledgerEntries];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.ref.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') result = result.filter((e) => e.type === typeFilter);
    if (currencyFilter !== 'all') result = result.filter((e) => e.originalCurrency === currencyFilter);
    if (flaggedOnly) result = result.filter((e) => e.flagged);

    result.sort((a, b) => {
      if (sortOrder === 'newest') return b.date.localeCompare(a.date);
      if (sortOrder === 'oldest') return a.date.localeCompare(b.date);
      if (sortOrder === 'highest') {
        return (
          convertToBase(b.originalAmount, b.originalCurrency) -
          convertToBase(a.originalAmount, a.originalCurrency)
        );
      }
      return (
        convertToBase(a.originalAmount, a.originalCurrency) -
        convertToBase(b.originalAmount, b.originalCurrency)
      );
    });

    return result;
  }, [ledgerEntries, search, typeFilter, currencyFilter, flaggedOnly, sortOrder, convertToBase]);

  // Group entries by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((entry) => {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
    });
    return Object.entries(groups).sort(([a], [b]) =>
      sortOrder === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)
    );
  }, [filtered, sortOrder]);

  function handleExport() {
    Alert.alert(
      'Export Ledger',
      `Export ${filtered.length} entries for ${activeTenant?.name} as CSV or PDF?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'CSV', onPress: () => Alert.alert('Exported', 'Ledger CSV queued for download.') },
        { text: 'PDF', onPress: () => Alert.alert('Exported', 'Ledger PDF report queued for download.') },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Ledger</Text>
          <Text style={styles.pageSubtitle}>{activeTenant?.name} · Retail Cash Flow</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.75}>
          <Feather name="download" size={13} color={COLORS.blue} />
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Band */}
      <LedgerSummaryBand
        entries={ledgerEntries}
        convertToBase={convertToBase}
        formatCurrency={formatCurrency}
      />

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={14} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search description, ref, category…"
          placeholderTextColor={COLORS.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x-circle" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Row 1: Type + Flagged */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {/* Type filters */}
        {['all', 'inflow', 'outflow'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.filterChip,
              typeFilter === t && styles.filterChipActive,
              t === 'inflow' && typeFilter === t && { borderColor: COLORS.emerald, backgroundColor: COLORS.emeraldDim },
              t === 'outflow' && typeFilter === t && { borderColor: COLORS.crimson, backgroundColor: COLORS.crimsonDim },
            ]}
            onPress={() => setTypeFilter(t)}
          >
            {t === 'inflow' && <Feather name="arrow-down-left" size={10} color={typeFilter === t ? COLORS.emerald : COLORS.textMuted} />}
            {t === 'outflow' && <Feather name="arrow-up-right" size={10} color={typeFilter === t ? COLORS.crimson : COLORS.textMuted} />}
            <Text
              style={[
                styles.filterChipText,
                typeFilter === t && styles.filterChipTextActive,
                t === 'inflow' && typeFilter === t && { color: COLORS.emerald },
                t === 'outflow' && typeFilter === t && { color: COLORS.crimson },
              ]}
            >
              {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterSep} />

        {/* Currency filters */}
        {['all', ...CURRENCIES].map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.filterChip, currencyFilter === c && styles.filterChipActive]}
            onPress={() => setCurrencyFilter(c)}
          >
            <Text style={[styles.filterChipText, currencyFilter === c && styles.filterChipTextActive]}>
              {c === 'all' ? 'All Currencies' : c}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterSep} />

        {/* AML flagged filter */}
        <TouchableOpacity
          style={[styles.filterChip, flaggedOnly && { borderColor: COLORS.crimson, backgroundColor: COLORS.crimsonDim }]}
          onPress={() => setFlaggedOnly((v) => !v)}
        >
          <Feather name="flag" size={10} color={flaggedOnly ? COLORS.crimson : COLORS.textMuted} />
          <Text style={[styles.filterChipText, flaggedOnly && { color: COLORS.crimson }]}>
            AML Flagged
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sort Row */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {[
          { id: 'newest', label: 'Newest' },
          { id: 'oldest', label: 'Oldest' },
          { id: 'highest', label: 'Highest' },
          { id: 'lowest', label: 'Lowest' },
        ].map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.sortChip, sortOrder === s.id && styles.sortChipActive]}
            onPress={() => setSortOrder(s.id)}
          >
            <Text style={[styles.sortChipText, sortOrder === s.id && styles.sortChipTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.resultCount}>{filtered.length} entries</Text>
      </View>

      {/* Column headers */}
      <View style={styles.colHeaders}>
        <Text style={[styles.colHeader, { flex: 3 }]}>Transaction</Text>
        <Text style={[styles.colHeader, { flex: 2, textAlign: 'right' }]}>Amount ({baseCurrency})</Text>
      </View>

      {/* Grouped ledger entries */}
      {grouped.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyStateTitle}>No entries found</Text>
          <Text style={styles.emptyStateText}>Try adjusting your filters or search query</Text>
        </View>
      ) : (
        grouped.map(([date, entries]) => (
          <View key={date}>
            {/* Date group header */}
            <View style={styles.dateGroupHeader}>
              <Text style={styles.dateGroupLabel}>{formatDate(date)}</Text>
              <View style={styles.dateGroupLine} />
              <Text style={styles.dateGroupCount}>{entries.length}</Text>
            </View>

            {/* Entries for this date */}
            <View style={styles.dateGroupEntries}>
              {entries.map((entry, i) => (
                <View key={entry.id}>
                  {i > 0 && <View style={styles.entryDivider} />}
                  <LedgerRow
                    entry={entry}
                    convertToBase={convertToBase}
                    formatCurrency={formatCurrency}
                    baseCurrency={baseCurrency}
                  />
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      {/* Currency conversion note */}
      <View style={styles.conversionNote}>
        <Feather name="info" size={11} color={COLORS.textMuted} />
        <Text style={styles.conversionNoteText}>
          Amounts converted to {baseCurrency} using live rates. Original transaction currencies shown inline.
          Tap any row to expand split-currency detail.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1437' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pageTitle: { color: '#F1F5F9', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  pageSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exportBtnText: { color: '#3B82F6', fontSize: 12, fontWeight: '700' },
  summaryBand: {
    flexDirection: 'row',
    backgroundColor: '#111D4A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3060',
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryBandLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  summaryBandValue: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  summaryBandDivider: { width: 1, height: 32, backgroundColor: '#1E3060' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111D4A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3060',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 13,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingBottom: 2,
    marginBottom: 10,
  },
  filterSep: { width: 1, height: 20, backgroundColor: '#1E3060', marginHorizontal: 2 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#111D4A',
    borderWidth: 1,
    borderColor: '#1E3060',
  },
  filterChipActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: '#3B82F6',
  },
  filterChipText: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  filterChipTextActive: { color: '#3B82F6' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sortLabel: { color: '#475569', fontSize: 10, fontWeight: '600' },
  sortChip: {
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#111D4A',
    borderWidth: 1,
    borderColor: '#1E3060',
  },
  sortChipActive: { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: '#3B82F6' },
  sortChipText: { color: '#94A3B8', fontSize: 10 },
  sortChipTextActive: { color: '#3B82F6', fontWeight: '700' },
  resultCount: { color: '#475569', fontSize: 10, marginLeft: 'auto' },
  colHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  colHeader: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    marginTop: 8,
  },
  dateGroupLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  dateGroupLine: { flex: 1, height: 1, backgroundColor: '#1E3060' },
  dateGroupCount: {
    color: '#475569',
    fontSize: 10,
    backgroundColor: '#111D4A',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#1E3060',
  },
  dateGroupEntries: {
    backgroundColor: '#111D4A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3060',
    marginBottom: 4,
    overflow: 'hidden',
  },
  entryDivider: { height: 1, backgroundColor: '#1E3060' },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  ledgerRowFlagged: {
    backgroundColor: 'rgba(239,68,68,0.04)',
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  ledgerCenter: { flex: 1 },
  ledgerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  ledgerDesc: { color: '#F1F5F9', fontSize: 12, fontWeight: '600', flex: 1 },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  flagPillText: { color: '#EF4444', fontSize: 8, fontWeight: '800' },
  ledgerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  ledgerDate: { color: '#475569', fontSize: 10 },
  ledgerDot: { color: '#1E3060', fontSize: 10 },
  ledgerCat: { fontSize: 10, fontWeight: '600' },
  ledgerOriginal: { color: '#94A3B8', fontSize: 10, fontStyle: 'italic' },
  ledgerRight: { alignItems: 'flex-end', flexShrink: 0, minWidth: 90 },
  ledgerAmount: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  expandedBlock: {
    marginTop: 10,
    backgroundColor: '#0B1437',
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3060',
  },
  expandedLabel: { color: '#94A3B8', fontSize: 11 },
  expandedRef: { color: '#64748B', fontSize: 10, fontFamily: 'monospace', fontWeight: '600' },
  expandedValue: { color: '#F1F5F9', fontSize: 12, fontWeight: '700' },
  viewFlagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  viewFlagBtnText: { color: '#F59E0B', fontSize: 11, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyStateTitle: { color: '#94A3B8', fontSize: 16, fontWeight: '700' },
  emptyStateText: { color: '#475569', fontSize: 13 },
  conversionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  conversionNoteText: { color: '#475569', fontSize: 11, flex: 1, lineHeight: 16 },
});
