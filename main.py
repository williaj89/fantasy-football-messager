import requests
from pywhatkit import sendwhatmsg_to_group_instantly


def main() -> None:
    league_id = None  # Add league id here
    endpoint_url = f"https://fantasy.premierleague.com/api/leagues-classic/{league_id}/standings/"
    group_id = None  # Add whatsapp group id here

    response = requests.get(endpoint_url)
    data = response.json()

    standings = data.get('standings', {}).get('results', [])
    sorted_standings = sorted(standings, key=lambda x: x['total'], reverse=True)
    leaderboard = []
    for index, team in enumerate(sorted_standings, start=1):
        rank_change = team['rank'] - team['last_rank']
        if rank_change < 0:
            direction = '⬆'  # ⬆️
        elif rank_change > 0:
            direction = '⬇'  # ⬇️
        else:
            direction = '◀'  # ◀️
        rank_change = abs(rank_change)
        leaderboard.append(f"{index}. {team['entry_name']} {direction} {rank_change}")
    message = "\n".join(leaderboard)
    sendwhatmsg_to_group_instantly(group_id, message)


if __name__ == "__main__":
    main()
