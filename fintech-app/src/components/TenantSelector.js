import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinancial } from '../context/FinancialContext';

const COLORS = {
  navy: '#0B1437',
  navyLight: '#111D4A',
  slate: '#1A2750',
  border: '#1E3060',
  emerald: '#10B981',
  emeraldDim: '#065F46',
  amber: '#F59E0B',
  amberDim: '#78350F',
  crimson: '#EF4444',
  crimsonDim: '#7F1D1D',
  blue: '#3B82F6',
  blueDim: '#1E3A8A',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
};

function healthColor(score) {
  if (score >= 90) return COLORS.emerald;
  if (score >= 75) return COLORS.amber;
  return COLORS.crimson;
}

function healthBg(score) {
  if (score >= 90) return COLORS.emeraldDim;
  if (score >= 75) return COLORS.amberDim;
  return COLORS.crimsonDim;
}

function statusLabel(status) {
  return status === 'active' ? 'Active' : status === 'review' ? 'Under Review' : 'Suspended';
}

function statusColor(status) {
  return status === 'active' ? COLORS.emerald : status === 'review' ? COLORS.amber : COLORS.crimson;
}

export default function TenantSelector() {
  const { tenants, activeTenantId, setActiveTenantId, activeTenant } = useFinancial();
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  function selectTenant(id) {
    setActiveTenantId(id);
    setModalVisible(false);
  }

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
        <View style={styles.leftRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>FRP</Text>
          </View>
          <View>
            <Text style={styles.platformLabel}>Financial Reporting Platform</Text>
            <Text style={styles.tenantBranch}>{activeTenant?.branch}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.selectorButton} onPress={() => setModalVisible(true)} activeOpacity={0.75}>
          <View style={styles.selectorLeft}>
            <Text style={styles.selectorName} numberOfLines={1}>
              {activeTenant?.name}
            </Text>
            <View style={[styles.healthBadge, { backgroundColor: healthBg(activeTenant?.complianceHealth) }]}>
              <Text style={[styles.healthText, { color: healthColor(activeTenant?.complianceHealth) }]}>
                {activeTenant?.complianceHealth}% Health
              </Text>
            </View>
          </View>
          <Feather name="chevron-down" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModalVisible(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Business Entity</Text>
          <Text style={styles.sheetSubtitle}>Financial data isolates per tenant</Text>

          <FlatList
            data={tenants}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isActive = item.id === activeTenantId;
              return (
                <TouchableOpacity
                  style={[styles.tenantRow, isActive && styles.tenantRowActive]}
                  onPress={() => selectTenant(item.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.tenantRowLeft}>
                    <View style={[styles.tenantDot, { backgroundColor: statusColor(item.status) }]} />
                    <View>
                      <Text style={styles.tenantName}>{item.name}</Text>
                      <Text style={styles.tenantBranchSmall}>{item.branch}</Text>
                    </View>
                  </View>

                  <View style={styles.tenantRowRight}>
                    <View style={[styles.healthPill, { backgroundColor: healthBg(item.complianceHealth) }]}>
                      <Text style={[styles.healthPillText, { color: healthColor(item.complianceHealth) }]}>
                        {item.complianceHealth}%
                      </Text>
                    </View>
                    <Text style={[styles.statusTag, { color: statusColor(item.status) }]}>
                      {statusLabel(item.status)}
                    </Text>
                    {isActive && <Feather name="check-circle" size={16} color={COLORS.blue} style={{ marginLeft: 8 }} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B1437',
    borderBottomWidth: 1,
    borderBottomColor: '#1E3060',
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  platformLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tenantBranch: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111D4A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3060',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    maxWidth: 180,
  },
  selectorLeft: {
    flex: 1,
    gap: 3,
  },
  selectorName: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
  },
  healthBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  healthText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111D4A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#1E3060',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#1E3060',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#1E3060',
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  tenantRowActive: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    paddingHorizontal: 8,
  },
  tenantRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tenantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tenantName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  tenantBranchSmall: {
    color: '#94A3B8',
    fontSize: 11,
  },
  tenantRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  healthPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
