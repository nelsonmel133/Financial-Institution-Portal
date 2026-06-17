import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
  emeraldDim: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B',
  amberDim: 'rgba(245,158,11,0.12)',
  crimson: '#EF4444',
  crimsonDim: 'rgba(239,68,68,0.12)',
  purple: '#8B5CF6',
  purpleDim: 'rgba(139,92,246,0.12)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
};

const SEVERITY_CONFIG = {
  high: { color: COLORS.crimson, bg: COLORS.crimsonDim, label: 'HIGH', icon: 'alert-octagon' },
  medium: { color: COLORS.amber, bg: COLORS.amberDim, label: 'MED', icon: 'alert-triangle' },
  low: { color: COLORS.blue, bg: COLORS.blueDim, label: 'LOW', icon: 'info' },
};

const STATUS_CONFIG = {
  pending_review: { color: COLORS.amber, label: 'Pending Review' },
  under_investigation: { color: COLORS.crimson, label: 'Under Investigation' },
  escalated: { color: COLORS.crimson, label: 'Escalated' },
  due: { color: COLORS.amber, label: 'Due' },
  overdue: { color: COLORS.crimson, label: 'Overdue' },
  ready: { color: COLORS.emerald, label: 'Ready to File' },
  resolved: { color: COLORS.emerald, label: 'Resolved' },
};

const FLAG_TYPE_LABELS = {
  AML_THRESHOLD: 'AML Cash Threshold',
  SUSPICIOUS_PATTERN: 'Suspicious Pattern',
  REGULATORY_FILING: 'Regulatory Filing',
  VAULT_DISCREPANCY: 'Vault Discrepancy',
};

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatAmount(amount, currency) {
  if (!amount) return null;
  const sym = { USD: '$', ZWG: 'ZWG ', ZAR: 'R' }[currency] || '';
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ComplianceSummaryBar({ flags }) {
  const high = flags.filter((f) => f.severity === 'high').length;
  const medium = flags.filter((f) => f.severity === 'medium').length;
  const low = flags.filter((f) => f.severity === 'low').length;

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <View style={[styles.summaryDot, { backgroundColor: COLORS.crimson }]} />
        <Text style={styles.summaryCount}>{high}</Text>
        <Text style={styles.summaryLabel}>High</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <View style={[styles.summaryDot, { backgroundColor: COLORS.amber }]} />
        <Text style={styles.summaryCount}>{medium}</Text>
        <Text style={styles.summaryLabel}>Medium</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <View style={[styles.summaryDot, { backgroundColor: COLORS.blue }]} />
        <Text style={styles.summaryCount}>{low}</Text>
        <Text style={styles.summaryLabel}>Low</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Feather name="flag" size={12} color={COLORS.textSecondary} />
        <Text style={styles.summaryCount}>{flags.length}</Text>
        <Text style={styles.summaryLabel}>Total</Text>
      </View>
    </View>
  );
}

function HealthGauge({ score }) {
  const color = score >= 90 ? COLORS.emerald : score >= 75 ? COLORS.amber : COLORS.crimson;
  const bgColor = score >= 90 ? COLORS.emeraldDim : score >= 75 ? COLORS.amberDim : COLORS.crimsonDim;
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Needs Attention' : 'Critical';

  return (
    <View style={[styles.healthGauge, { backgroundColor: bgColor, borderColor: color + '44' }]}>
      <View style={styles.healthGaugeLeft}>
        <Text style={styles.healthGaugeTitle}>Compliance Health Score</Text>
        <Text style={[styles.healthGaugeLabel, { color }]}>{label}</Text>
      </View>
      <View style={styles.healthScoreBlock}>
        <Text style={[styles.healthScore, { color }]}>{score}</Text>
        <Text style={[styles.healthScoreMax, { color: color + '88' }]}>/100</Text>
      </View>
    </View>
  );
}

function FlagCard({ flag, formatCurrency }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[flag.severity];
  const stat = STATUS_CONFIG[flag.status] || { color: COLORS.textSecondary, label: flag.status };

  return (
    <TouchableOpacity
      style={[styles.flagCard, { borderLeftColor: sev.color }]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
    >
      {/* Header row */}
      <View style={styles.flagCardHeader}>
        <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
          <Feather name={sev.icon} size={11} color={sev.color} />
          <Text style={[styles.sevText, { color: sev.color }]}>{sev.label}</Text>
        </View>
        <Text style={styles.flagTypeLabel}>{FLAG_TYPE_LABELS[flag.type] || flag.type}</Text>
        <View style={[styles.statusBadge, { backgroundColor: stat.color + '22' }]}>
          <Text style={[styles.statusText, { color: stat.color }]}>{stat.label}</Text>
        </View>
      </View>

      {/* Message */}
      <Text style={styles.flagMessage}>{flag.message}</Text>

      {/* Ref row */}
      <View style={styles.flagMeta}>
        <Feather name="hash" size={10} color={COLORS.textMuted} />
        <Text style={styles.flagRef}>{flag.transactionRef}</Text>
        <Text style={styles.flagTimestamp}>{formatTimestamp(flag.timestamp)}</Text>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.flagExpanded}>
          <View style={styles.expandDivider} />
          {flag.amount && (
            <View style={styles.expandRow}>
              <Text style={styles.expandLabel}>Transaction Amount</Text>
              <Text style={[styles.expandValue, { color: sev.color }]}>
                {formatAmount(flag.amount, flag.currency)}
              </Text>
            </View>
          )}
          {flag.amount && flag.currency === 'USD' && flag.amount >= 10000 && (
            <View style={styles.amlAlert}>
              <Feather name="alert-octagon" size={12} color={COLORS.crimson} />
              <Text style={styles.amlAlertText}>
                Exceeds $10,000 USD CTR reporting threshold — Currency Transaction Report required under AML regulations.
              </Text>
            </View>
          )}
          <View style={styles.expandRow}>
            <Text style={styles.expandLabel}>Severity Level</Text>
            <Text style={[styles.expandValue, { color: sev.color }]}>{flag.severity.toUpperCase()}</Text>
          </View>
          <View style={styles.expandRow}>
            <Text style={styles.expandLabel}>Current Status</Text>
            <Text style={[styles.expandValue, { color: stat.color }]}>{stat.label}</Text>
          </View>
          <View style={styles.expandActions}>
            <TouchableOpacity
              style={[styles.expandActionBtn, { borderColor: COLORS.blue }]}
              onPress={() => Alert.alert('Escalate', `Flag ${flag.transactionRef} escalated to compliance officer.`)}
            >
              <Feather name="arrow-up-circle" size={13} color={COLORS.blue} />
              <Text style={[styles.expandActionText, { color: COLORS.blue }]}>Escalate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.expandActionBtn, { borderColor: COLORS.emerald }]}
              onPress={() => Alert.alert('Mark Resolved', `Flag ${flag.transactionRef} marked as resolved.`)}
            >
              <Feather name="check-circle" size={13} color={COLORS.emerald} />
              <Text style={[styles.expandActionText, { color: COLORS.emerald }]}>Resolve</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.expandToggle}>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function RegulatorySubmissions() {
  const submissions = [
    { id: 'S1', name: 'Currency Transaction Report (CTR)', period: 'Jan 2025', status: 'due', dueDate: 'Jan 18, 2025', authority: 'RBZ' },
    { id: 'S2', name: 'Suspicious Activity Report (SAR)', period: 'Q4 2024', status: 'overdue', dueDate: 'Jan 10, 2025', authority: 'ZIMRA' },
    { id: 'S3', name: 'Monthly Compliance Health Report', period: 'Jan 2025', status: 'ready', dueDate: 'Jan 31, 2025', authority: 'RBZ' },
    { id: 'S4', name: 'Foreign Currency Exposure Report', period: 'Jan 2025', status: 'resolved', dueDate: 'Jan 15, 2025', authority: 'ZIMRA' },
  ];

  return (
    <View style={styles.submissionsCard}>
      <Text style={styles.sectionTitle}>Regulatory Submissions</Text>
      {submissions.map((sub, i) => {
        const stat = STATUS_CONFIG[sub.status] || { color: COLORS.textSecondary, label: sub.status };
        return (
          <View key={sub.id}>
            {i > 0 && <View style={styles.rowDivider} />}
            <View style={styles.submissionRow}>
              <View style={styles.submissionLeft}>
                <Text style={styles.submissionName}>{sub.name}</Text>
                <Text style={styles.submissionMeta}>
                  {sub.authority} · {sub.period} · Due {sub.dueDate}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, { borderColor: stat.color + '55', backgroundColor: stat.color + '18' }]}
                onPress={() =>
                  Alert.alert(
                    'Submission',
                    sub.status === 'ready'
                      ? `Submit ${sub.name} to ${sub.authority}?`
                      : `${sub.name} is ${stat.label}.`
                  )
                }
              >
                <Text style={[styles.submitBtnText, { color: stat.color }]}>{stat.label}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function ComplianceScreen() {
  const insets = useSafeAreaInsets();
  const { activeTenant, complianceFlags, formatCurrency } = useFinancial();
  const [filterSeverity, setFilterSeverity] = useState('all');

  if (!activeTenant) return null;

  const filtered =
    filterSeverity === 'all'
      ? complianceFlags
      : complianceFlags.filter((f) => f.severity === filterSeverity);

  function handleExport() {
    Alert.alert(
      'Export Compliance Report',
      `Generating PDF audit report for ${activeTenant.name}.\n\nIncludes: ${complianceFlags.length} flags, regulatory submission status, and AML threshold analysis.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', style: 'default', onPress: () => Alert.alert('Export queued', 'Report will be ready in your downloads shortly.') },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Compliance</Text>
          <Text style={styles.pageSubtitle}>{activeTenant.name} · Audit & AML</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.75}>
          <Feather name="download" size={13} color={COLORS.blue} />
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Health Gauge */}
      <HealthGauge score={activeTenant.complianceHealth} />

      {/* Summary bar */}
      <ComplianceSummaryBar flags={complianceFlags} />

      {/* Section: AML Flags */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>AML & Compliance Flags</Text>
        <View style={styles.filterRow}>
          {['all', 'high', 'medium', 'low'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filterSeverity === f && styles.filterChipActive]}
              onPress={() => setFilterSeverity(f)}
            >
              <Text style={[styles.filterChipText, filterSeverity === f && styles.filterChipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={32} color={COLORS.emerald} />
          <Text style={styles.emptyStateText}>No {filterSeverity !== 'all' ? filterSeverity + ' ' : ''}flags for this entity</Text>
        </View>
      ) : (
        filtered.map((flag) => (
          <FlagCard key={flag.id} flag={flag} formatCurrency={formatCurrency} />
        ))
      )}

      {/* AML Threshold Notice */}
      <View style={styles.amlNoticeCard}>
        <View style={styles.amlNoticeHeader}>
          <Feather name="shield" size={14} color={COLORS.purple} />
          <Text style={styles.amlNoticeTitle}>AML Cash Threshold Policy</Text>
        </View>
        <Text style={styles.amlNoticeBody}>
          Any single cash transaction equal to or exceeding{' '}
          <Text style={{ color: COLORS.crimson, fontWeight: '700' }}>USD $10,000</Text> triggers an automatic
          Currency Transaction Report (CTR) under RBZ Anti-Money Laundering regulations. Structured
          transactions designed to avoid this threshold constitute a reportable{' '}
          <Text style={{ color: COLORS.amber, fontWeight: '600' }}>Suspicious Activity (SAR)</Text>.
        </Text>
        <View style={styles.thresholdRow}>
          <View style={styles.thresholdItem}>
            <Text style={styles.thresholdAmount}>$10,000</Text>
            <Text style={styles.thresholdLabel}>CTR Threshold (USD)</Text>
          </View>
          <View style={styles.thresholdDivider} />
          <View style={styles.thresholdItem}>
            <Text style={[styles.thresholdAmount, { color: COLORS.amber }]}>
              ZWG {(10000 * 13.56).toLocaleString()}
            </Text>
            <Text style={styles.thresholdLabel}>Equivalent (ZWG)</Text>
          </View>
          <View style={styles.thresholdDivider} />
          <View style={styles.thresholdItem}>
            <Text style={[styles.thresholdAmount, { color: COLORS.blue }]}>
              R {(10000 * 18.42).toLocaleString()}
            </Text>
            <Text style={styles.thresholdLabel}>Equivalent (ZAR)</Text>
          </View>
        </View>
      </View>

      {/* Regulatory Submissions */}
      <RegulatorySubmissions />

      {/* Audit Trail */}
      <View style={styles.auditCard}>
        <Text style={styles.sectionTitle}>Recent Audit Trail</Text>
        {[
          { time: '09:42', action: 'AML flag raised — TXN-20250115-0042', user: 'System', type: 'flag' },
          { time: '09:40', action: 'Cash drawer reconciliation completed', user: 'Tawanda M.', type: 'ok' },
          { time: '08:15', action: 'Compliance health score recalculated', user: 'System', type: 'info' },
          { time: 'Yesterday', action: 'SAR submitted to ZIMRA for Q4 2024', user: 'Compliance Officer', type: 'ok' },
          { time: 'Yesterday', action: 'Vault discrepancy reported — $340 variance', user: 'Branch Manager', type: 'warn' },
        ].map((entry, i) => (
          <View key={i} style={styles.auditRow}>
            <View
              style={[
                styles.auditDot,
                {
                  backgroundColor:
                    entry.type === 'flag' ? COLORS.crimson
                    : entry.type === 'warn' ? COLORS.amber
                    : entry.type === 'ok' ? COLORS.emerald
                    : COLORS.blue,
                },
              ]}
            />
            <View style={styles.auditContent}>
              <Text style={styles.auditAction}>{entry.action}</Text>
              <Text style={styles.auditMeta}>{entry.user} · {entry.time}</Text>
            </View>
          </View>
        ))}
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
  healthGauge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  healthGaugeLeft: { flex: 1 },
  healthGaugeTitle: { color: '#F1F5F9', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  healthGaugeLabel: { fontSize: 12, fontWeight: '600' },
  healthScoreBlock: { flexDirection: 'row', alignItems: 'flex-end' },
  healthScore: { fontSize: 42, fontWeight: '800', lineHeight: 46 },
  healthScoreMax: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#111D4A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3060',
    padding: 14,
    marginBottom: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryCount: { color: '#F1F5F9', fontSize: 18, fontWeight: '800' },
  summaryLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '500' },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#1E3060' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#111D4A',
    borderWidth: 1,
    borderColor: '#1E3060',
  },
  filterChipActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' },
  filterChipText: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  filterChipTextActive: { color: '#3B82F6' },
  flagCard: {
    backgroundColor: '#111D4A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3060',
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
  },
  flagCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  sevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  sevText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  flagTypeLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', flex: 1 },
  statusBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },
  flagMessage: { color: '#F1F5F9', fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 8 },
  flagMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flagRef: { color: '#475569', fontSize: 10, fontWeight: '600', fontFamily: 'monospace', flex: 1 },
  flagTimestamp: { color: '#475569', fontSize: 10 },
  flagExpanded: { marginTop: 4 },
  expandDivider: { height: 1, backgroundColor: '#1E3060', marginVertical: 12 },
  expandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expandLabel: { color: '#94A3B8', fontSize: 12 },
  expandValue: { color: '#F1F5F9', fontSize: 13, fontWeight: '700' },
  amlAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  amlAlertText: { color: '#EF4444', fontSize: 11, lineHeight: 16, flex: 1 },
  expandActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  expandActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
  },
  expandActionText: { fontSize: 12, fontWeight: '700' },
  expandToggle: { alignItems: 'center', marginTop: 8 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyStateText: { color: '#94A3B8', fontSize: 14 },
  amlNoticeCard: {
    backgroundColor: '#111D4A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    padding: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  amlNoticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  amlNoticeTitle: { color: '#F1F5F9', fontSize: 14, fontWeight: '700' },
  amlNoticeBody: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1437',
    borderRadius: 8,
    padding: 12,
  },
  thresholdItem: { flex: 1, alignItems: 'center' },
  thresholdAmount: { color: '#EF4444', fontSize: 13, fontWeight: '800', marginBottom: 3 },
  thresholdLabel: { color: '#475569', fontSize: 9, textAlign: 'center' },
  thresholdDivider: { width: 1, height: 32, backgroundColor: '#1E3060' },
  submissionsCard: {
    backgroundColor: '#111D4A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3060',
    padding: 16,
    marginBottom: 16,
  },
  rowDivider: { height: 1, backgroundColor: '#1E3060', marginVertical: 2 },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 10,
  },
  submissionLeft: { flex: 1 },
  submissionName: { color: '#F1F5F9', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  submissionMeta: { color: '#475569', fontSize: 10 },
  submitBtn: {
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  submitBtnText: { fontSize: 10, fontWeight: '700' },
  auditCard: {
    backgroundColor: '#111D4A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E3060',
    padding: 16,
    marginBottom: 8,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3060',
  },
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  auditContent: { flex: 1 },
  auditAction: { color: '#F1F5F9', fontSize: 12, fontWeight: '500', lineHeight: 17, marginBottom: 2 },
  auditMeta: { color: '#475569', fontSize: 10 },
});
