import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinancial } from '../context/FinancialContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 140;

const COLORS = {
  navy: '#0B1437',
  navyLight: '#111D4A',
  border: '#1E3060',
  blue: '#3B82F6',
  emerald: '#10B981',
  emeraldDim: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B',
  amberDim: 'rgba(245,158,11,0.12)',
  crimson: '#EF4444',
  crimsonDim: 'rgba(239,68,68,0.12)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
};

function MetricCard({ icon, label, value, subValue, subLabel, trend, color, bgColor }) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIconWrap, { backgroundColor: bgColor }]}>
          <Feather name={icon} size={15} color={color} />
        </View>
        {trend !== undefined && (
          <View style={[styles.trendBadge, { backgroundColor: trend >= 0 ? COLORS.emeraldDim : COLORS.crimsonDim }]}>
            <Feather
              name={trend >= 0 ? 'trending-up' : 'trending-down'}
              size={10}
              color={trend >= 0 ? COLORS.emerald : COLORS.crimson}
            />
            <Text style={[styles.trendText, { color: trend >= 0 ? COLORS.emerald : COLORS.crimson }]}>
              {Math.abs(trend).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {subValue && (
        <Text style={styles.metricSub}>
          {subLabel}: {subValue}
        </Text>
      )}
    </View>
  );
}

function CashFlowChart({ data, baseCurrency, convertToBase, formatCurrency }) {
  if (!data || data.length === 0) return null;

  const allVals = data.flatMap((d) => [d.inflow, d.outflow]);
  const maxVal = Math.max(...allVals);
  const barAreaWidth = CHART_WIDTH - 40;
  const barGroupWidth = barAreaWidth / data.length;
  const barWidth = Math.min((barGroupWidth - 8) / 2, 14);

  function barHeight(val) {
    return (val / maxVal) * (CHART_HEIGHT - 30);
  }

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Weekly Cash Flow</Text>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.emerald }]} />
            <Text style={styles.legendLabel}>Inflow</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.crimson }]} />
            <Text style={styles.legendLabel}>Outflow</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartBody}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <Text key={fraction} style={styles.yLabel}>
              {formatCurrency(convertToBase(maxVal * fraction, 'USD'), baseCurrency)
                .replace(/(\.\d{2})/, '')
                .trim()}
            </Text>
          ))}
        </View>

        {/* Bars */}
        <View style={styles.barsArea}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <View
              key={f}
              style={[
                styles.gridLine,
                { bottom: f * (CHART_HEIGHT - 30) + 20 },
              ]}
            />
          ))}

          {data.map((item, i) => {
            const inflowH = barHeight(item.inflow);
            const outflowH = barHeight(item.outflow);
            const groupX = i * barGroupWidth + barGroupWidth / 2 - barWidth;

            return (
              <View
                key={item.day}
                style={[styles.barGroup, { left: groupX }]}
              >
                {/* Inflow bar */}
                <View
                  style={[
                    styles.bar,
                    {
                      height: inflowH,
                      width: barWidth,
                      backgroundColor: COLORS.emerald,
                      opacity: 0.85,
                    },
                  ]}
                />
                {/* Outflow bar */}
                <View
                  style={[
                    styles.bar,
                    {
                      height: outflowH,
                      width: barWidth,
                      backgroundColor: COLORS.crimson,
                      opacity: 0.75,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxis}>
        {data.map((item) => (
          <Text key={item.day} style={styles.xLabel}>
            {item.day}
          </Text>
        ))}
      </View>
    </View>
  );
}

function DrawerCard({ label, amount, icon, convertToBase, formatCurrency, baseCurrency }) {
  const converted = convertToBase(amount, 'USD');
  return (
    <View style={styles.drawerCard}>
      <Feather name={icon} size={14} color={COLORS.textSecondary} />
      <Text style={styles.drawerLabel}>{label}</Text>
      <Text style={styles.drawerValue}>{formatCurrency(converted)}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { activeTenant, baseCurrency, convertToBase, formatCurrency, complianceFlags } = useFinancial();

  if (!activeTenant) return null;

  const { metrics, cashFlowTrend } = activeTenant;

  const revenue = convertToBase(metrics.totalRevenue, 'USD');
  const netCash = convertToBase(metrics.netCashFlow, 'USD');
  const pending = convertToBase(metrics.pendingAssets, 'USD');

  const pendingFlags = complianceFlags.filter((f) => f.status === 'pending_review' || f.status === 'escalated').length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Dashboard</Text>
          <Text style={styles.pageSubtitle}>{activeTenant.name} · {activeTenant.branch}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Feather name="calendar" size={11} color={COLORS.textSecondary} />
          <Text style={styles.dateText}>Jan 15, 2025</Text>
        </View>
      </View>

      {/* Compliance Alert Banner */}
      {pendingFlags > 0 && (
        <View style={styles.alertBanner}>
          <Feather name="alert-triangle" size={14} color={COLORS.amber} />
          <Text style={styles.alertText}>
            {pendingFlags} compliance {pendingFlags === 1 ? 'flag' : 'flags'} require immediate review
          </Text>
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{pendingFlags}</Text>
          </View>
        </View>
      )}

      {/* Metric Cards */}
      <View style={styles.metricsGrid}>
        <MetricCard
          icon="dollar-sign"
          label="Total Revenue"
          value={formatCurrency(revenue)}
          trend={8.4}
          color={COLORS.blue}
          bgColor="rgba(59,130,246,0.12)"
        />
        <MetricCard
          icon="activity"
          label="Net Cash Flow"
          value={formatCurrency(Math.abs(netCash))}
          subLabel={netCash >= 0 ? 'Surplus' : 'Deficit'}
          trend={netCash >= 0 ? 3.2 : -5.1}
          color={netCash >= 0 ? COLORS.emerald : COLORS.crimson}
          bgColor={netCash >= 0 ? COLORS.emeraldDim : COLORS.crimsonDim}
        />
        <MetricCard
          icon="clock"
          label="Pending Assets"
          value={formatCurrency(pending)}
          subLabel="Status"
          subValue="Under review"
          color={COLORS.amber}
          bgColor={COLORS.amberDim}
        />
      </View>

      {/* Cash Flow Chart */}
      <CashFlowChart
        data={cashFlowTrend}
        baseCurrency={baseCurrency}
        convertToBase={convertToBase}
        formatCurrency={formatCurrency}
      />

      {/* Cash Management Row */}
      <Text style={styles.sectionTitle}>Cash Positions</Text>
      <View style={styles.drawerGrid}>
        <DrawerCard
          label="Drawer Balance"
          amount={metrics.drawerBalance}
          icon="inbox"
          convertToBase={convertToBase}
          formatCurrency={formatCurrency}
          baseCurrency={baseCurrency}
        />
        <DrawerCard
          label="Vault Reserve"
          amount={metrics.vaultReserve}
          icon="archive"
          convertToBase={convertToBase}
          formatCurrency={formatCurrency}
          baseCurrency={baseCurrency}
        />
        <DrawerCard
          label="Processing Register"
          amount={metrics.processingRegister}
          icon="refresh-cw"
          convertToBase={convertToBase}
          formatCurrency={formatCurrency}
          baseCurrency={baseCurrency}
        />
      </View>

      {/* Currency basis note */}
      <View style={styles.basisNote}>
        <Feather name="info" size={11} color={COLORS.textMuted} />
        <Text style={styles.basisNoteText}>
          All values displayed in {baseCurrency}. Tap currency cells above to change base currency.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1437',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pageTitle: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111D4A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1E3060',
  },
  dateText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  alertBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  alertBadgeText: {
    color: '#0B1437',
    fontSize: 10,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#111D4A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E3060',
    borderLeftWidth: 3,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
  },
  trendText: {
    fontSize: 9,
    fontWeight: '700',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  metricSub: {
    color: '#475569',
    fontSize: 9,
  },
  chartCard: {
    backgroundColor: '#111D4A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E3060',
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  chartBody: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingTop: 0,
  },
  yLabel: {
    color: '#475569',
    fontSize: 8,
    textAlign: 'right',
  },
  barsArea: {
    flex: 1,
    height: CHART_HEIGHT,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1E3060',
  },
  barGroup: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
    paddingLeft: 40,
  },
  xLabel: {
    color: '#475569',
    fontSize: 9,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  drawerGrid: {
    gap: 8,
    marginBottom: 16,
  },
  drawerCard: {
    backgroundColor: '#111D4A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3060',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  drawerLabel: {
    color: '#94A3B8',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  drawerValue: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  basisNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  basisNoteText: {
    color: '#475569',
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
});
