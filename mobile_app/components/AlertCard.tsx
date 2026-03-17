import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { IconSymbol } from './ui/icon-symbol';

interface Alert {
    id: string;
    type: string;
    severity: string;
    lat: number;
    lng: number;
    timestamp: string;
    camera_id?: string;
}

interface AlertCardProps {
    alert: Alert;
    onPress?: () => void;
}

export function AlertCard({ alert, onPress }: AlertCardProps) {
    const getSeverityColor = (severity: string) => {
        switch (severity.toUpperCase()) {
            case 'CRITICAL': return '#FF3B30';
            case 'HIGH': return '#FF9500';
            case 'MEDIUM': return '#FFCC00';
            default: return '#34C759';
        }
    };

    const getIconName = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('fire')) return 'flame.fill';
        if (t.includes('person') || t.includes('body')) return 'person.fill.viewfinder';
        if (t.includes('vehicle') || t.includes('car')) return 'car.fill';
        if (t.includes('bag') || t.includes('suspicious')) return 'bag.fill';
        return 'exclamationmark.triangle.fill';
    };

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
            <View style={[styles.severityBar, { backgroundColor: getSeverityColor(alert.severity) }]} />
            <ThemedView style={styles.cardContent}>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <IconSymbol name={getIconName(alert.type) as any} size={20} color={getSeverityColor(alert.severity)} />
                        <ThemedText type="defaultSemiBold" style={{ marginLeft: 8 }}>{alert.type}</ThemedText>
                    </View>
                    <ThemedView style={[styles.badge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                        <ThemedText style={styles.badgeText}>{alert.severity}</ThemedText>
                    </ThemedView>
                </View>

                <View style={styles.detailsRow}>
                    <IconSymbol name="location.fill" size={12} color="#888" />
                    <ThemedText style={styles.detailText}>{`Lat: ${alert.lat.toFixed(4)}, Lng: ${alert.lng.toFixed(4)}`}</ThemedText>
                </View>

                <View style={styles.detailsRow}>
                    <IconSymbol name="clock.fill" size={12} color="#888" />
                    <ThemedText style={styles.detailText}>{new Date(alert.timestamp).toLocaleTimeString()}</ThemedText>
                </View>

            </ThemedView>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        backgroundColor: '#fff', // fallback
    },
    severityBar: {
        width: 6,
        height: '100%',
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    detailText: {
        fontSize: 12,
        color: '#888',
        marginLeft: 6,
    }
});
