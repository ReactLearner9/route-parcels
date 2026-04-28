type BatchPayload = {
  parcels: Array<Record<string, unknown>>;
};

self.onmessage = (event: MessageEvent<{ text: string }>) => {
  try {
    const parsed = JSON.parse(event.data.text) as BatchPayload;

    if (!parsed || !Array.isArray(parsed.parcels)) {
      throw new Error('Batch file must contain a parcels array');
    }

    self.postMessage({ ok: true, payload: parsed });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid batch JSON'
    });
  }
};

export {};
