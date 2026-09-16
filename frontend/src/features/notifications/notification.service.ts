export interface StaffNotification {
  notification_id: string;
  staff_actor_id: string;
  title: string;
  message: string;
  type: string;
  sound: string;
  metadata: Record<string, any>;
  is_read: boolean;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
}

class NotificationService {
  private audioCtx: AudioContext | null = null;

  /**
   * Phát âm thanh chuông thông báo trực tiếp qua Web Audio API (Hoàn toàn miễn phí, không bị lỗi thiếu file audio)
   */
  public playNotificationChime(soundType: 'ALERT_CHIME' | 'URGENT_ALARM' | 'STANDARD' = 'ALERT_CHIME') {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      if (soundType === 'URGENT_ALARM') {
        // Chuông khẩn cấp (3 tiếng bíp cao)
        [0, 0.2, 0.4].forEach((delay) => {
          const osc = this.audioCtx!.createOscillator();
          const gain = this.audioCtx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, now + delay); // Note A5
          gain.gain.setValueAtTime(0.3, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.15);
          osc.connect(gain);
          gain.connect(this.audioCtx!.destination);
          osc.start(now + delay);
          osc.stop(now + delay + 0.15);
        });
      } else {
        // Chuông thông báo ca trực mặc định (Âm điệu 2 âm sắc dịu nhẹ)
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // Note C5
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.3);

        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.15); // Note E5
        gain2.gain.setValueAtTime(0.3, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.6);
      }
    } catch (e) {
      console.warn('Web Audio Playback Error:', e);
    }
  }

  /**
   * Đăng ký Web Push Notification trên điện thoại
   */
  public async registerWebPushPermission(actorId: string): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notification is not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission not granted.');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Đăng ký với key dummy hoặc public key
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(
            'BEl62iUYgUivxIkv69yViEuiBIj-m84qk8m-O8q_A-89912038102931-102391029381'
          ),
        });
      }

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-id': actorId,
        },
        body: JSON.stringify(subscription),
      });

      return true;
    } catch (e) {
      console.warn('Failed to subscribe push notification:', e);
      return false;
    }
  }

  /**
   * Lấy danh sách thông báo từ API
   */
  public async getMyNotifications(actorId: string): Promise<{ notifications: StaffNotification[]; unreadCount: number }> {
    try {
      const res = await fetch('/api/notifications/my-notifications', {
        headers: {
          'x-actor-id': actorId,
        },
      });
      if (!res.ok) throw new Error('API error');
      return await res.json();
    } catch (e) {
      return { notifications: [], unreadCount: 0 };
    }
  }

  /**
   * Đánh dấu đã đọc
   */
  public async markAsRead(notificationId: string, actorId: string) {
    await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'x-actor-id': actorId,
      },
    });
  }

  /**
   * Nhân viên xác nhận ca trực
   */
  public async acknowledgeShift(notificationId: string, actorId: string) {
    const res = await fetch(`/api/notifications/${notificationId}/acknowledge`, {
      method: 'PATCH',
      headers: {
        'x-actor-id': actorId,
      },
    });
    return await res.json();
  }

  /**
   * Gửi thông báo thử nghiệm âm thanh
   */
  public async sendTestNotification(actorId: string) {
    this.playNotificationChime('ALERT_CHIME');
    const res = await fetch('/api/notifications/test-sound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-id': actorId,
      },
      body: JSON.stringify({
        title: '🔔 Thử nghiệm âm thanh ca trực Tâm An Care',
        message: 'Chuông báo hoạt động bình thường trên điện thoại của bạn!',
        sound: 'ALERT_CHIME',
      }),
    });
    return await res.json();
  }

  private urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const notificationService = new NotificationService();
