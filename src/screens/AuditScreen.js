import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { AUDIT_GROUPS, auditToCsv, describe, describeGroup, formatWhen, groupEntries, who } from '../audit';
import { backupFileName } from '../backup';
import { saveBackupFile } from '../backupIO';
import { Button, Card, Chip, FilterChip } from '../components/ui';
import { colors } from '../theme';

const PAGE = 100;

// dot color of a line
const toneOf = (action) =>
  action === 'login.failed' || action.startsWith('reset.') || action === 'backup.restore' || action.endsWith('.delete') || action === 'account.game.remove' || action === 'admin.revoke'
    ? colors.danger
    : action === 'login' || action === 'logout' || action === 'password.change'
    ? '#2F5BE0'
    : action.startsWith('result.') || action.startsWith('tiebreak.') || action.startsWith('placement.')
    ? colors.success
    : colors.muted;

// Admin only: who signed in, who set which winner, and every other change. Newest first.
export default function AuditScreen() {
  const { api, isAdmin, mode } = useStore();
  const [filter, setFilter] = useState('all');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({}); // folded groups that are expanded, by id of the first line
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const seq = useRef(0); // ignores an answer that arrives after the filter changed

  const actions = useMemo(() => (AUDIT_GROUPS.find((g) => g.key === filter) || AUDIT_GROUPS[0]).actions, [filter]);

  const load = useCallback(
    async (reset) => {
      if (!api) return;
      const mine = ++seq.current;
      setError(null);
      try {
        const before = reset || entries.length === 0 ? null : entries[entries.length - 1].id;
        const rows = await api.getAudit({ limit: PAGE, before, actions });
        if (mine !== seq.current) return;
        setEntries((old) => (reset ? rows : [...old, ...rows]));
        setMore(rows.length === PAGE);
      } catch (e) {
        if (mine !== seq.current) return;
        setError(/sf_audit|relation|schema cache|does not exist/i.test(e.message || '') ? 'The audit trail is not set up yet. Run supabase/schema.sql again in the Supabase SQL Editor.' : e.message || 'Cannot load the audit trail.');
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, actions, entries]
  );

  useEffect(() => {
    setLoading(true);
    setEntries([]);
    setOpen({});
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, api]);

  const groups = useMemo(() => groupEntries(entries), [entries]);

  const exportCsv = async () => {
    setBusy(true);
    setNote(null);
    try {
      let all = [];
      let before = null;
      for (let i = 0; i < 20; i++) {
        const rows = await api.getAudit({ limit: 500, before, actions });
        all = all.concat(rows);
        if (rows.length < 500) break;
        before = rows[rows.length - 1].id;
      }
      const name = backupFileName().replace('sportsfest-backup', 'sportsfest-audit').replace(/\.json$/, '.csv');
      await saveBackupFile(auditToCsv(all), name, 'text/csv');
      setNote(`${all.length} line(s) exported.`);
    } catch (e) {
      setNote(e.message || 'Cannot export.');
    } finally {
      setBusy(false);
    }
  };

  if (mode !== 'cloud') {
    return <Text style={styles.empty}>The audit trail needs Supabase. In local mode nothing is recorded.</Text>;
  }
  if (!isAdmin) {
    return <Text style={styles.empty}>Only the admin can see the audit trail.</Text>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
    >
      <View style={styles.filters}>
        {AUDIT_GROUPS.map((g) => (
          <FilterChip key={g.key} label={g.label} active={filter === g.key} onPress={() => setFilter(g.key)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Button title="Refresh" icon="refresh" small kind="ghost" onPress={() => { setRefreshing(true); load(true); }} />
        <Button title={busy ? 'Exporting…' : 'Export to Excel (CSV)'} icon="download-outline" small kind="ghost" onPress={exportCsv} disabled={busy || entries.length === 0} />
      </View>
      {note ? <Text style={[styles.note, { marginBottom: 10 }]}>{note}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} /> : null}
      {!loading && !error && groups.length === 0 ? <Text style={styles.empty}>Nothing recorded yet.</Text> : null}

      {groups.map((g) => {
        const e = g.head;
        const expanded = !!open[e.id];
        return (
          <Pressable key={e.id} onPress={() => g.count > 1 && setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))} disabled={g.count === 1}>
            <Card style={{ marginBottom: 8, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.dot, { backgroundColor: toneOf(e.action) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.when}>{formatWhen(e.at)}</Text>
                  <Text style={styles.who}>{who(e)}</Text>
                  <Text style={styles.what}>{describeGroup(g)}</Text>
                  {g.count > 1 ? <Text style={styles.more}>{expanded ? 'Hide the lines' : `Show the ${g.count} lines`}</Text> : null}
                </View>
                {g.count > 1 ? <Chip label={`× ${g.count}`} /> : null}
              </View>
              {expanded
                ? g.items.map((it) => (
                    <View key={it.id} style={styles.sub}>
                      <Text style={styles.when}>{formatWhen(it.at)}</Text>
                      <Text style={styles.what}>{describe(it)}</Text>
                    </View>
                  ))
                : null}
            </Card>
          </Pressable>
        );
      })}

      {more && !loading ? <Button title="Show older lines" kind="ghost" onPress={() => load(false)} style={{ marginTop: 6 }} /> : null}
      <Text style={[styles.note, { marginTop: 18 }]}>
        Times are in this device’s time. The lines cannot be edited or deleted from the app. Changes made by the database owner in the SQL editor show as “Unknown (no login)”.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  when: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  who: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 1 },
  what: { fontSize: 14, color: colors.text, marginTop: 2, lineHeight: 19 },
  more: { fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 4 },
  sub: { marginTop: 8, paddingTop: 8, marginLeft: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
  error: { color: colors.danger, fontWeight: '700', marginBottom: 10, lineHeight: 19 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
