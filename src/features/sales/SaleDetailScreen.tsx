import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { lineProfit, marginRate, saleProfit } from '@/models';
import { saleService } from '@/services/sale.service';
import { ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { useQuery } from '@/shared/hooks/useQuery';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { salesMessages } from './sales.messages';

export function SaleDetailScreen({ saleId }: { readonly saleId: string }) {
  const t = useMessages(salesMessages);
  const common = useMessages(commonMessages);
  const fetchDetail = useCallback(() => saleService.getDetail(saleId), [saleId]);
  const { data: detail, error } = useQuery(fetchDetail);

  if (detail === null) {
    return error === null ? <LoadingView /> : <ErrorBanner message={error} />;
  }

  const { sale, client, orderReference, lines } = detail;
  const profit = saleProfit(sale);
  const rate = marginRate(sale.totalAmount, profit);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: sale.reference }} />

      <View style={styles.card}>
        <Text style={styles.reference}>{sale.reference}</Text>
        <Text style={styles.meta}>
          {formatDisplayDateTime(sale.soldAt)} · {common.paymentMethod[sale.paymentMethod]}
        </Text>
        <View style={styles.separator} />
        <Text style={styles.label}>{t.client}</Text>
        <Text style={styles.value}>{client?.name ?? t.walkInClient}</Text>
        {client !== null ? (
          <Text
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/clients/[id]', params: { id: client.id } })}
            style={styles.link}
          >
            {t.seeClient}
          </Text>
        ) : null}
        {orderReference !== null && sale.orderId !== null ? (
          <>
            <Text style={[styles.label, styles.spaced]}>{t.originOrder}</Text>
            <Text
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/orders/[id]', params: { id: sale.orderId ?? '' } })}
              style={styles.link}
            >
              {orderReference}
            </Text>
          </>
        ) : null}
        {sale.notes ? (
          <>
            <Text style={[styles.label, styles.spaced]}>{t.notes}</Text>
            <Text style={styles.value}>{sale.notes}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t.soldProducts}</Text>
        {lines.map(({ item, productName, productImageUri }) => {
          const margin = lineProfit(item);
          return (
            <View key={item.id} style={styles.line}>
              <Thumbnail name={productName} imageUri={productImageUri} size={40} />
              <View style={styles.lineTexts}>
                <Text style={styles.value} numberOfLines={1}>
                  {productName}
                </Text>
                <Text style={styles.meta}>
                  {item.quantity} × {formatMoney(item.unitPrice)} · {t.purchasePrice(formatMoney(item.unitCost))}
                </Text>
              </View>
              <View style={styles.lineAmounts}>
                <Text style={styles.lineTotal}>{formatMoney(item.lineTotal)}</Text>
                <Text style={[styles.lineMargin, margin < 0 && styles.loss]}>
                  {margin >= 0 ? '+' : ''}
                  {formatMoney(margin)}
                </Text>
              </View>
            </View>
          );
        })}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.meta}>{t.totalCost}</Text>
            <Text style={styles.value}>{formatMoney(sale.totalCost)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.meta}>{t.profitWithMargin(rate === null ? null : rate.toFixed(0))}</Text>
            <Text style={[styles.profit, profit < 0 && styles.loss]}>{formatMoney(profit)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.totalCollected}</Text>
            <Text style={styles.totalValue}>{formatMoney(sale.totalAmount)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.note}>
        {sale.orderId === null ? t.stockNoteSale : t.stockNoteOrder}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  reference: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  spaced: { marginTop: spacing.sm },
  value: { fontSize: fontSize.md, color: colors.text },
  link: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineTexts: { flex: 1 },
  lineAmounts: { alignItems: 'flex-end' },
  lineTotal: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  lineMargin: { fontSize: fontSize.sm, fontWeight: '600', color: colors.success, fontVariant: ['tabular-nums'] },
  loss: { color: colors.danger },
  totals: { paddingTop: spacing.md, gap: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profit: { fontSize: fontSize.md, fontWeight: '700', color: colors.success, fontVariant: ['tabular-nums'] },
  totalLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primaryDark, fontVariant: ['tabular-nums'] },
  note: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
});
