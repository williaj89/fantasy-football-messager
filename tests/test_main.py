import unittest
from unittest.mock import patch, MagicMock
import requests
import main


class TestFantasyLeague(unittest.TestCase):
    def setUp(self):
        self.mock_response = {
            'standings': {
                'results': [
                    {'entry_name': 'Team 1', 'rank': 1, 'last_rank': 4, 'total': 100},
                    {'entry_name': 'Team 2', 'rank': 2, 'last_rank': 1, 'total': 90},
                    {'entry_name': 'Team 3', 'rank': 3, 'last_rank': 3, 'total': 85},
                    {'entry_name': 'Team 4', 'rank': 4, 'last_rank': 2, 'total': 80},
                    {'entry_name': 'Team 5', 'rank': 5, 'last_rank': 5, 'total': 75},
                ]
            }
        }

    @patch('main.requests.get')
    def test_get_league_data(self, mock_get):

        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_response
        mock_get.return_value = mock_response

        def modified_main():
            league_id = 1
            endpoint_url = f"https://test.com/api/leagues-classic/{league_id}/standings/"

            response = requests.get(endpoint_url)
            data = response.json()
            return data

        with patch('main.requests.get', mock_get):
            result = modified_main()

        mock_get.assert_called_once()
        self.assertEqual(result, self.mock_response)

    def test_format_standings_message(self):
        standings = self.mock_response['standings']['results']
        sorted_standings = sorted(standings, key=lambda x: x['total'], reverse=True)

        leaderboard = []
        for index, team in enumerate(sorted_standings, start=1):
            rank_change = team['last_rank'] - team['rank']
            if rank_change > 0:
                direction = '⬆'
            elif rank_change < 0:
                direction = '⬇'
            else:
                direction = '◀'
            rank_change = abs(rank_change)
            leaderboard.append(f"{index}. {team['entry_name']} {direction} {rank_change}")

        message = "\n".join(leaderboard)

        expected_message = (
            "1. Team 1 ⬆ 3\n"
            "2. Team 2 ⬇ 1\n"
            "3. Team 3 ◀ 0\n"
            "4. Team 4 ⬇ 2\n"
            "5. Team 5 ◀ 0"
        )

        self.assertEqual(message, expected_message)

    @patch('main.requests.get')
    @patch('main.sendwhatmsg_instantly')
    def test_main_sends_correct_message(self, mock_send_msg, mock_get):

        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_response
        mock_get.return_value = mock_response

        main.main()

        expected_message = (
            "1. Team 1 ⬆ 3\n"
            "2. Team 2 ⬇ 1\n"
            "3. Team 3 ◀ 0\n"
            "4. Team 4 ⬇ 2\n"
            "5. Team 5 ◀ 0"
        )

        mock_send_msg.assert_called_once_with('1', expected_message)


if __name__ == '__main__':
    unittest.main()