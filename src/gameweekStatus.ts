export interface GameweekStatus {
  id: number;
  finished: boolean;
  dataChecked: boolean;
}

interface BootstrapEvent {
  id: number;
  is_current: boolean;
  finished: boolean;
  data_checked: boolean;
}

interface BootstrapStaticResponse {
  events?: BootstrapEvent[];
}

export async function fetchCurrentGameweekStatus(): Promise<GameweekStatus | null> {
  try {
    const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    if (!response.ok) {
      console.warn(`bootstrap-static returned status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as BootstrapStaticResponse;
    const currentEvent = data.events?.find((event) => event.is_current);

    if (!currentEvent) {
      return null;
    }

    return {
      id: currentEvent.id,
      finished: currentEvent.finished,
      dataChecked: currentEvent.data_checked,
    };
  } catch (error) {
    console.warn('Failed to fetch or parse bootstrap-static (likely maintenance mode):', error);
    return null;
  }
}

export function isFinalized(status: GameweekStatus | null): status is GameweekStatus {
  return status !== null && status.finished && status.dataChecked;
}
