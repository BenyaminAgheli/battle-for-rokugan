import asyncio
import json
import os
import random
import socket
import uuid
from aiohttp import web

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# --- GAME DATA & CONSTANTS ---

CLANS = {
    "Crab": {"color": "#2b4c7e", "capital": "crab_1", "ability": "+1 Defense in all controlled provinces."},
    "Crane": {"color": "#6ec5e9", "capital": "crane_1", "ability": "Gain +2 Honor whenever placing a Diplomat token."},
    "Dragon": {"color": "#2d6a4f", "capital": "dragon_1", "ability": "Gain +1 Strength to all tokens placed inside your own provinces."},
    "Lion": {"color": "#d4a373", "capital": "lion_1", "ability": "+1 Attack Strength with all Army tokens."},
    "Phoenix": {"color": "#e76f51", "capital": "phoenix_1", "ability": "Blessing tokens add +3 instead of +2."},
    "Scorpion": {"color": "#9b2226", "capital": "scorpion_1", "ability": "+1 Attack Strength with all Shinobi tokens."},
    "Unicorn": {"color": "#7209b7", "capital": "unicorn_1", "ability": "+1 Attack Strength in non-capital provinces."}
}

PROVINCES = {
    # Unicorn Clan Lands (Northwest)
    "unicorn_1": {"name": "Shiro Moto", "territory": "Unicorn Lands", "defense": 2, "honor": 1, "coastal": False, "capital_of": "Unicorn", "x": 220, "y": 220},
    "unicorn_2": {"name": "Shinjo Steppes", "territory": "Unicorn Lands", "defense": 1, "honor": 2, "coastal": False, "capital_of": None, "x": 290, "y": 135},
    "unicorn_3": {"name": "Moto Plains", "territory": "Unicorn Lands", "defense": 1, "honor": 2, "coastal": False, "capital_of": None, "x": 335, "y": 290},

    # Dragon Clan Lands (Northern Mountains)
    "dragon_1": {"name": "High Mountains", "territory": "Dragon Lands", "defense": 3, "honor": 1, "coastal": False, "capital_of": "Dragon", "x": 560, "y": 190},
    "dragon_2": {"name": "Mirumoto Peaks", "territory": "Dragon Lands", "defense": 2, "honor": 2, "coastal": False, "capital_of": None, "x": 500, "y": 110},
    "dragon_3": {"name": "Togashi Valley", "territory": "Dragon Lands", "defense": 1, "honor": 2, "coastal": False, "capital_of": None, "x": 600, "y": 280},

    # Phoenix Clan Lands (Northeast Coast & Mountains)
    "phoenix_1": {"name": "Kyuden Isawa", "territory": "Phoenix Lands", "defense": 2, "honor": 2, "coastal": True, "capital_of": "Phoenix", "x": 810, "y": 195},
    "phoenix_2": {"name": "Gisei Toshi", "territory": "Phoenix Lands", "defense": 2, "honor": 2, "coastal": True, "capital_of": None, "x": 740, "y": 120},
    "phoenix_3": {"name": "Shiba Grove", "territory": "Phoenix Lands", "defense": 1, "honor": 2, "coastal": True, "capital_of": None, "x": 840, "y": 295},

    # Lion Clan Lands (Central Heartland)
    "lion_1": {"name": "Castle of Swift Sword", "territory": "Lion Lands", "defense": 2, "honor": 1, "coastal": False, "capital_of": "Lion", "x": 540, "y": 380},
    "lion_2": {"name": "Matsu Plains", "territory": "Lion Lands", "defense": 1, "honor": 2, "coastal": False, "capital_of": None, "x": 440, "y": 345},
    "lion_3": {"name": "Ikoma Fields", "territory": "Lion Lands", "defense": 1, "honor": 3, "coastal": False, "capital_of": None, "x": 510, "y": 480},

    # Crane Clan Lands (Central East Coast)
    "crane_1": {"name": "Kyuden Doji", "territory": "Crane Lands", "defense": 2, "honor": 2, "coastal": True, "capital_of": "Crane", "x": 795, "y": 455},
    "crane_2": {"name": "Daidoji Plains", "territory": "Crane Lands", "defense": 1, "honor": 2, "coastal": True, "capital_of": None, "x": 740, "y": 355},
    "crane_3": {"name": "Asahina Coast", "territory": "Crane Lands", "defense": 1, "honor": 3, "coastal": True, "capital_of": None, "x": 750, "y": 565},

    # Scorpion Clan Lands (West Central)
    "scorpion_1": {"name": "Kyuden Bayushi", "territory": "Scorpion Lands", "defense": 2, "honor": 1, "coastal": False, "capital_of": "Scorpion", "x": 395, "y": 490},
    "scorpion_2": {"name": "Ryoko Owari", "territory": "Scorpion Lands", "defense": 1, "honor": 3, "coastal": False, "capital_of": None, "x": 305, "y": 400},
    "scorpion_3": {"name": "Beiden Pass", "territory": "Scorpion Lands", "defense": 2, "honor": 2, "coastal": False, "capital_of": None, "x": 315, "y": 550},

    # Crab Clan Lands (South above Kaiu Wall)
    "crab_1": {"name": "Kaiu Wall", "territory": "Crab Lands", "defense": 3, "honor": 1, "coastal": False, "capital_of": "Crab", "x": 490, "y": 695},
    "crab_2": {"name": "Carpenter Pass", "territory": "Crab Lands", "defense": 2, "honor": 2, "coastal": False, "capital_of": None, "x": 445, "y": 595},
    "crab_3": {"name": "Hida Coast", "territory": "Crab Lands", "defense": 1, "honor": 2, "coastal": True, "capital_of": None, "x": 620, "y": 685},

    # Shadowlands (Southwest Demonic Corruption)
    "shadow_1": {"name": "Threshold of Evil", "territory": "Shadowlands", "defense": 2, "honor": 0, "coastal": False, "capital_of": None, "x": 190, "y": 595},
    "shadow_2": {"name": "Festering Pit", "territory": "Shadowlands", "defense": 3, "honor": 0, "coastal": False, "capital_of": None, "x": 200, "y": 700},

    # Islands of Silk and Spice (Southeast Sea)
    "island_1": {"name": "Gotai Island", "territory": "Silk and Spice", "defense": 1, "honor": 2, "coastal": True, "capital_of": None, "x": 980, "y": 475},
    "island_2": {"name": "Silk & Spice Isle", "territory": "Silk and Spice", "defense": 2, "honor": 3, "coastal": True, "capital_of": None, "x": 1020, "y": 580},
    "island_3": {"name": "Sunken Archipelago", "territory": "Silk and Spice", "defense": 1, "honor": 2, "coastal": True, "capital_of": None, "x": 990, "y": 685},
}

BORDERS = [
    # Unicorn internal & external
    {"id": "b_u1_u2", "p1": "unicorn_1", "p2": "unicorn_2", "coastal": False},
    {"id": "b_u1_u3", "p1": "unicorn_1", "p2": "unicorn_3", "coastal": False},
    {"id": "b_u2_d2", "p1": "unicorn_2", "p2": "dragon_2", "coastal": False},
    {"id": "b_u3_l2", "p1": "unicorn_3", "p2": "lion_2", "coastal": False},
    {"id": "b_u3_s2", "p1": "unicorn_3", "p2": "scorpion_2", "coastal": False},

    # Dragon internal & external
    {"id": "b_d1_d2", "p1": "dragon_1", "p2": "dragon_2", "coastal": False},
    {"id": "b_d1_d3", "p1": "dragon_1", "p2": "dragon_3", "coastal": False},
    {"id": "b_d1_p1", "p1": "dragon_1", "p2": "phoenix_1", "coastal": False},
    {"id": "b_d3_l1", "p1": "dragon_3", "p2": "lion_1", "coastal": False},
    {"id": "b_d3_p3", "p1": "dragon_3", "p2": "phoenix_3", "coastal": False},

    # Phoenix internal & external
    {"id": "b_p1_p2", "p1": "phoenix_1", "p2": "phoenix_2", "coastal": True},
    {"id": "b_p1_p3", "p1": "phoenix_1", "p2": "phoenix_3", "coastal": True},
    {"id": "b_p3_c2", "p1": "phoenix_3", "p2": "crane_2", "coastal": True},

    # Lion internal & external
    {"id": "b_l1_l2", "p1": "lion_1", "p2": "lion_2", "coastal": False},
    {"id": "b_l1_l3", "p1": "lion_1", "p2": "lion_3", "coastal": False},
    {"id": "b_l1_c2", "p1": "lion_1", "p2": "crane_2", "coastal": False},
    {"id": "b_l2_s2", "p1": "lion_2", "p2": "scorpion_2", "coastal": False},
    {"id": "b_l3_c1", "p1": "lion_3", "p2": "crane_1", "coastal": False},
    {"id": "b_l3_s1", "p1": "lion_3", "p2": "scorpion_1", "coastal": False},

    # Crane internal & external
    {"id": "b_c1_c2", "p1": "crane_1", "p2": "crane_2", "coastal": True},
    {"id": "b_c1_c3", "p1": "crane_1", "p2": "crane_3", "coastal": True},
    {"id": "b_c3_cr2", "p1": "crane_3", "p2": "crab_2", "coastal": False},
    {"id": "b_c3_isl1", "p1": "crane_3", "p2": "island_1", "coastal": True},

    # Scorpion internal & external
    {"id": "b_s1_s2", "p1": "scorpion_1", "p2": "scorpion_2", "coastal": False},
    {"id": "b_s1_s3", "p1": "scorpion_1", "p2": "scorpion_3", "coastal": False},
    {"id": "b_s3_cr2", "p1": "scorpion_3", "p2": "crab_2", "coastal": False},

    # Crab internal & external
    {"id": "b_cr1_cr2", "p1": "crab_1", "p2": "crab_2", "coastal": False},
    {"id": "b_cr1_cr3", "p1": "crab_1", "p2": "crab_3", "coastal": False},
    {"id": "b_cr1_sh2", "p1": "crab_1", "p2": "shadow_2", "coastal": False},
    {"id": "b_cr2_sh1", "p1": "crab_2", "p2": "shadow_1", "coastal": False},
    {"id": "b_cr3_isl3", "p1": "crab_3", "p2": "island_3", "coastal": True},

    # Shadowlands internal
    {"id": "b_sh1_sh2", "p1": "shadow_1", "p2": "shadow_2", "coastal": False},

    # Islands internal
    {"id": "b_isl1_isl2", "p1": "island_1", "p2": "island_2", "coastal": True},
    {"id": "b_isl2_isl3", "p1": "island_2", "p2": "island_3", "coastal": True},
]

SECRET_OBJECTIVES = [
    {"id": "obj_coastal", "name": "Master of Tides", "desc": "+4 Honor if you control at least 3 coastal provinces."},
    {"id": "obj_capitals", "name": "Usurper", "desc": "+5 Honor if you control at least 2 Clan Capitals."},
    {"id": "obj_northern", "name": "Northern Hegemon", "desc": "+4 Honor if you control 3+ provinces in Dragon, Phoenix, or Unicorn lands."},
    {"id": "obj_central", "name": "Heart of the Empire", "desc": "+4 Honor if you control at least 2 Lion provinces."},
    {"id": "obj_expander", "name": "Grand Conqueror", "desc": "+5 Honor if you control 5 or more provinces."},
    {"id": "obj_shadowlands", "name": "Lord of the Pit", "desc": "+5 Honor if you control at least 1 Shadowlands province."},
    {"id": "obj_islands", "name": "Silk & Spice Monopoly", "desc": "+5 Honor if you control at least 2 Island provinces."}
]

def create_starting_pool():
    pool = [
        {"type": "Army", "strength": 1}, {"type": "Army", "strength": 1}, {"type": "Army", "strength": 1},
        {"type": "Army", "strength": 2}, {"type": "Army", "strength": 2}, {"type": "Army", "strength": 2},
        {"type": "Army", "strength": 3}, {"type": "Army", "strength": 3},
        {"type": "Army", "strength": 4},
        {"type": "Navy", "strength": 1}, {"type": "Navy", "strength": 2}, {"type": "Navy", "strength": 3},
        {"type": "Shinobi", "strength": 1}, {"type": "Shinobi", "strength": 2}, {"type": "Shinobi", "strength": 3},
        {"type": "Blessing", "strength": 2}, {"type": "Blessing", "strength": 2},
        {"type": "Raid", "strength": 0},
        {"type": "Diplomat", "strength": 0},
        {"type": "Bluff", "strength": 0}
    ]
    for t in pool:
        t["id"] = str(uuid.uuid4())[:8]
    random.shuffle(pool)
    return pool


# --- GAME ENGINE ---

class GameState:
    def __init__(self):
        self.round = 1
        self.phase = "LOBBY"  # LOBBY, UPKEEP, PLACEMENT, RESOLUTION, GAME_OVER
        self.turn_player_id = None
        self.player_order = []
        self.first_player_idx = 0
        self.players = {}
        self.websockets = {}
        self.board = {"provinces": {}, "borders": {}, "placed_tokens": []}
        self.logs = ["Welcome to Battle for Rokugan LAN! Select a Clan and Ready up."]
        self.placements_this_round = 0
        self.init_board()

    def init_board(self):
        for pid, pdata in PROVINCES.items():
            self.board["provinces"][pid] = {
                **pdata,
                "id": pid,
                "controller": None,
                "scorched": False,
                "peace": False,
                "bonus_defense": 0
            }
        for b in BORDERS:
            self.board["borders"][b["id"]] = {**b}
        self.board["placed_tokens"] = []

    def log(self, msg):
        self.logs.append(msg)
        if len(self.logs) > 60:
            self.logs.pop(0)

    def add_player(self, pid, name):
        if pid not in self.players:
            self.players[pid] = {
                "id": pid,
                "name": name,
                "clan": None,
                "ready": False,
                "connected": True,
                "hand": [],
                "pool": [],
                "discard": [],
                "secret_objective": None,
                "bonus_honor": 0,
                "score": 0
            }
            self.log(f"{name} joined the lobby.")

    def can_start(self):
        if not (2 <= len(self.players) <= 5):
            return False
        return all(p["ready"] and p["clan"] for p in self.players.values())

    def start_game(self):
        self.init_board()
        self.round = 1
        self.player_order = list(self.players.keys())
        random.shuffle(self.player_order)
        self.first_player_idx = 0

        obj_deck = list(SECRET_OBJECTIVES)
        random.shuffle(obj_deck)

        for pid in self.player_order:
            p = self.players[pid]
            p["pool"] = create_starting_pool()
            p["hand"] = []
            p["discard"] = []
            p["bonus_honor"] = 0
            p["secret_objective"] = obj_deck.pop()

            # Control starting capital + 1 adjacent neutral province
            cap_id = CLANS[p["clan"]]["capital"]
            self.board["provinces"][cap_id]["controller"] = pid
            adj = self.get_adjacent_provinces(cap_id)
            for a_id in adj:
                if self.board["provinces"][a_id]["controller"] is None and not self.board["provinces"][a_id]["capital_of"]:
                    self.board["provinces"][a_id]["controller"] = pid
                    break

        self.log("Game Started! Capitals assigned and Secret Objectives dealt.")
        self.run_upkeep()

    def get_adjacent_provinces(self, prov_id):
        adj = []
        for b in BORDERS:
            if b["p1"] == prov_id:
                adj.append(b["p2"])
            elif b["p2"] == prov_id:
                adj.append(b["p1"])
        return adj

    def run_upkeep(self):
        self.phase = "UPKEEP"
        self.board["placed_tokens"] = []
        self.placements_this_round = 0

        # Rotate first player token each round after Round 1
        if self.round > 1:
            self.first_player_idx = (self.first_player_idx + 1) % len(self.player_order)

        first_pid = self.player_order[self.first_player_idx]
        self.log(f"--- ROUND {self.round} UPKEEP ---")
        self.log(f"Initiative belongs to {self.players[first_pid]['name']} ({self.players[first_pid]['clan']}).")

        # Draw up to 6 combat tokens (replenishing from discard if pool empties)
        for pid in self.player_order:
            p = self.players[pid]
            while len(p["hand"]) < 6:
                if not p["pool"]:
                    if p["discard"]:
                        p["pool"] = p["discard"][:]
                        p["discard"] = []
                        random.shuffle(p["pool"])
                    else:
                        break
                p["hand"].append(p["pool"].pop())

        self.phase = "PLACEMENT"
        self.turn_player_id = first_pid

    def is_legal_placement(self, pid, token, target_type, target_id, attack_target=None):
        ttype = token["type"]
        p = self.players[pid]

        if target_type == "province":
            if target_id not in self.board["provinces"]:
                return False, "Invalid province."
            prov = self.board["provinces"][target_id]
            if prov["scorched"]:
                return False, f"{prov['name']} is scorched earth and cannot receive tokens."
            if prov["peace"]:
                return False, f"{prov['name']} is at peace and cannot be targeted."

            if ttype == "Army":
                if prov["controller"] != pid:
                    return False, "Armies placed in a province can only defend a province you already control."
            elif ttype == "Navy":
                if not prov["coastal"]:
                    return False, "Navy tokens can only be placed in coastal provinces or coastal borders."
            elif ttype in ("Diplomat", "Blessing"):
                if prov["controller"] != pid:
                    return False, f"{ttype} tokens can only be placed inside a province you control."
            elif ttype in ("Shinobi", "Raid", "Bluff"):
                pass  # Shinobi, Raid, and Bluff can be placed in any non-scorched, non-peace province

        elif target_type == "border":
            if target_id not in self.board["borders"]:
                return False, "Invalid border."
            border = self.board["borders"][target_id]

            # Only ONE token per border!
            for pt in self.board["placed_tokens"]:
                if pt["target_type"] == "border" and pt["target_id"] == target_id:
                    return False, "This border is already occupied by a token this round."

            if attack_target not in (border["p1"], border["p2"]):
                return False, "Must specify which side of the border you are attacking."

            target_prov = self.board["provinces"][attack_target]
            other_side_id = border["p2"] if attack_target == border["p1"] else border["p1"]
            origin_prov = self.board["provinces"][other_side_id]

            if target_prov["scorched"]:
                return False, f"Cannot attack into {target_prov['name']} (Scorched Earth)."
            if target_prov["peace"]:
                return False, f"Cannot attack into {target_prov['name']} (Province is at Peace)."

            if ttype in ("Shinobi", "Raid", "Diplomat", "Blessing"):
                return False, f"{ttype} tokens must be placed in a province center, not on a border."

            if ttype == "Navy":
                if not border["coastal"]:
                    return False, "Navy tokens can only be placed on coastal borders."

            if ttype == "Army":
                # Must attack from a province you control or defend your own target province
                if origin_prov["controller"] != pid and target_prov["controller"] != pid:
                    return False, f"Army attack must originate from a province you control ({origin_prov['name']}) or defend your own ({target_prov['name']})."

            elif ttype == "Bluff":
                pass

        else:
            return False, "Invalid placement target type."

        return True, "Legal"

    def place_token(self, pid, token_id, target_type, target_id, attack_target=None):
        if self.phase != "PLACEMENT" or self.turn_player_id != pid:
            return False, "Not your turn to place a token."

        p = self.players[pid]
        token = next((t for t in p["hand"] if t["id"] == token_id), None)
        if not token:
            return False, "Token not found in hand."

        if target_type == "province":
            attack_target = target_id

        # Strict rules verification before allowing placement
        ok, reason = self.is_legal_placement(pid, token, target_type, target_id, attack_target)
        if not ok:
            return False, reason

        p["hand"].remove(token)
        self.board["placed_tokens"].append({
            "id": token["id"],
            "owner": pid,
            "token": token,
            "target_type": target_type,
            "target_id": target_id,
            "attack_target": attack_target,
            "is_face_down": True
        })

        self.placements_this_round += 1
        self.log(f"{p['name']} ({p['clan']}) placed a face-down token.")

        total_turns = len(self.player_order) * 5
        if self.placements_this_round >= total_turns:
            self.resolve_round()
        else:
            curr_idx = self.player_order.index(self.turn_player_id)
            next_idx = (curr_idx + 1) % len(self.player_order)
            self.turn_player_id = self.player_order[next_idx]

        return True, "Token placed."

    def resolve_round(self):
        self.phase = "RESOLUTION"
        self.turn_player_id = None
        self.log(f"--- ROUND {self.round} RESOLUTION ---")

        # 1. Reveal all tokens
        for pt in self.board["placed_tokens"]:
            pt["is_face_down"] = False

        # 2. Validate legality & discard Bluffs / invalid placements
        valid_tokens = []
        for pt in self.board["placed_tokens"]:
            t = pt["token"]
            owner = pt["owner"]
            ttype = t["type"]
            target_type = pt["target_type"]
            target_id = pt["target_id"]
            atk_target = pt["attack_target"]

            if ttype == "Bluff":
                self.log(f"{self.players[owner]['clan']}'s Bluff on {target_id} returned to hand.")
                self.players[owner]["hand"].append(t)
                continue

            if self.board["provinces"][atk_target]["scorched"]:
                self.log(f"{ttype} targeting scorched {PROVINCES[atk_target]['name']} discarded.")
                self.players[owner]["discard"].append(t)
                continue

            # Rules verification
            legal = True
            if ttype == "Army":
                if target_type == "border":
                    b = self.board["borders"][target_id]
                    other_side = b["p2"] if atk_target == b["p1"] else b["p1"]
                    if self.board["provinces"][other_side]["controller"] != owner:
                        legal = False
                elif target_type == "province":
                    if self.board["provinces"][target_id]["controller"] != owner:
                        legal = False

            elif ttype == "Navy":
                if target_type == "border":
                    if not self.board["borders"][target_id]["coastal"]:
                        legal = False
                elif target_type == "province":
                    if not self.board["provinces"][target_id]["coastal"]:
                        legal = False

            elif ttype in ("Shinobi", "Raid"):
                if target_type != "province":
                    legal = False

            elif ttype in ("Diplomat", "Blessing"):
                if target_type != "province" or self.board["provinces"][target_id]["controller"] != owner:
                    legal = False

            if not legal:
                self.log(f"Illegal placement: {self.players[owner]['clan']}'s {ttype} on {target_id} discarded!")
                self.players[owner]["discard"].append(t)
            else:
                valid_tokens.append(pt)

        # 3. Resolve Raid (Scorched Earth)
        raided_provinces = set()
        for pt in list(valid_tokens):
            if pt["token"]["type"] == "Raid":
                prov_id = pt["target_id"]
                if not self.board["provinces"][prov_id]["peace"]:
                    raided_provinces.add(prov_id)
                    self.board["provinces"][prov_id]["scorched"] = True
                    self.board["provinces"][prov_id]["controller"] = None
                    self.log(f"RAID! {PROVINCES[prov_id]['name']} is burned to Scorched Earth!")

        if raided_provinces:
            remaining = []
            for pt in valid_tokens:
                if pt["attack_target"] in raided_provinces:
                    self.players[pt["owner"]]["discard"].append(pt["token"])
                else:
                    remaining.append(pt)
            valid_tokens = remaining

        # 4. Resolve Diplomats (Peace)
        peace_provinces = set()
        for pt in list(valid_tokens):
            if pt["token"]["type"] == "Diplomat":
                prov_id = pt["target_id"]
                peace_provinces.add(prov_id)
                self.board["provinces"][prov_id]["peace"] = True
                owner = pt["owner"]
                if self.players[owner]["clan"] == "Crane":
                    self.players[owner]["bonus_honor"] += 2
                    self.log(f"Crane Diplomat brings Peace to {PROVINCES[prov_id]['name']} (+2 Crane Honor)!")
                else:
                    self.log(f"Diplomat brings lasting Peace to {PROVINCES[prov_id]['name']}!")

        if peace_provinces:
            remaining = []
            for pt in valid_tokens:
                if pt["attack_target"] in peace_provinces and pt["token"]["type"] != "Blessing":
                    self.players[pt["owner"]]["discard"].append(pt["token"])
                else:
                    remaining.append(pt)
            valid_tokens = remaining

        # 5. Resolve Battles per Province
        for prov_id, prov in self.board["provinces"].items():
            if prov["scorched"] or prov["peace"]:
                continue

            contenders = {}
            current_ctrl = prov["controller"]

            prov_tokens = [pt for pt in valid_tokens if pt["attack_target"] == prov_id]
            if not prov_tokens:
                continue

            blessings = {}
            for pt in prov_tokens:
                if pt["token"]["type"] == "Blessing":
                    owner = pt["owner"]
                    b_val = 3 if self.players[owner]["clan"] == "Phoenix" else 2
                    blessings[owner] = blessings.get(owner, 0) + b_val

            for pt in prov_tokens:
                t = pt["token"]
                if t["type"] in ("Army", "Navy", "Shinobi"):
                    owner = pt["owner"]
                    clan = self.players[owner]["clan"]
                    strength = t["strength"]

                    # Clan Combat Abilities
                    if clan == "Lion" and t["type"] == "Army":
                        strength += 1
                    elif clan == "Scorpion" and t["type"] == "Shinobi":
                        strength += 1
                    elif clan == "Dragon" and pt["target_type"] == "province" and current_ctrl == owner:
                        strength += 1
                    elif clan == "Unicorn" and owner != current_ctrl and not prov["capital_of"]:
                        strength += 1

                    contenders[owner] = contenders.get(owner, 0) + strength

            for owner, b_bonus in blessings.items():
                if owner in contenders or owner == current_ctrl:
                    contenders[owner] = contenders.get(owner, 0) + b_bonus

            if not contenders:
                continue

            # Add innate province defense to current controller
            if current_ctrl:
                base_def = prov["defense"] + prov["bonus_defense"]
                if self.players[current_ctrl]["clan"] == "Crab":
                    base_def += 1
                contenders[current_ctrl] = contenders.get(current_ctrl, 0) + base_def

            # Determine highest strength (Defender wins ties)
            sorted_contenders = sorted(
                contenders.items(),
                key=lambda item: (item[1], 1 if item[0] == current_ctrl else 0),
                reverse=True
            )

            winner_id, win_str = sorted_contenders[0]
            if len(sorted_contenders) > 1:
                second_id, sec_str = sorted_contenders[1]
                if win_str == sec_str and winner_id != current_ctrl:
                    self.log(f"Stalemate in {prov['name']} ({win_str} vs {sec_str})! Control unchanged.")
                    continue

            if winner_id != current_ctrl:
                prov["controller"] = winner_id
                prov["bonus_defense"] += 1
                w_name = self.players[winner_id]["clan"]
                self.log(f"{w_name} conquers {prov['name']} with strength {win_str}!")
            else:
                w_name = self.players[winner_id]["clan"]
                self.log(f"{w_name} successfully defends {prov['name']} (Strength {win_str}).")

        # Move all placed tokens to public discard
        for pt in valid_tokens:
            self.players[pt["owner"]]["discard"].append(pt["token"])

        self.update_scores()

        if self.round >= 5:
            self.phase = "GAME_OVER"
            self.declare_winner()

    def next_round(self):
        if self.phase == "RESOLUTION" and self.round < 5:
            self.round += 1
            self.run_upkeep()

    def update_scores(self):
        territories = {}
        for pid, prov in self.board["provinces"].items():
            territories.setdefault(prov["territory"], []).append(prov)

        for pid, p in self.players.items():
            honor = p["bonus_honor"]
            controlled = [pr for pr in self.board["provinces"].values() if pr["controller"] == pid]

            # 1. Province Honor
            for pr in controlled:
                honor += pr["honor"]

            # 2. Full Territory Bonus (+3 Honor per full territory)
            for t_name, t_provs in territories.items():
                if all(pr["controller"] == pid for pr in t_provs):
                    honor += 3

            # 3. Secret Objective Bonus
            if self.phase == "GAME_OVER" or self.round == 5:
                obj = p["secret_objective"]
                if obj:
                    if obj["id"] == "obj_coastal" and sum(1 for pr in controlled if pr["coastal"]) >= 3:
                        honor += 4
                    elif obj["id"] == "obj_capitals" and sum(1 for pr in controlled if pr["capital_of"]) >= 2:
                        honor += 5
                    elif obj["id"] == "obj_northern" and sum(1 for pr in controlled if pr["territory"] in ("Dragon Lands", "Phoenix Lands", "Unicorn Lands")) >= 3:
                        honor += 4
                    elif obj["id"] == "obj_central" and sum(1 for pr in controlled if pr["territory"] == "Lion Lands") >= 2:
                        honor += 4
                    elif obj["id"] == "obj_expander" and len(controlled) >= 5:
                        honor += 5
                    elif obj["id"] == "obj_shadowlands" and sum(1 for pr in controlled if pr["territory"] == "Shadowlands") >= 1:
                        honor += 5
                    elif obj["id"] == "obj_islands" and sum(1 for pr in controlled if pr["territory"] == "Silk and Spice") >= 2:
                        honor += 5

            p["score"] = honor

    def declare_winner(self):
        self.update_scores()
        ranked = sorted(self.players.values(), key=lambda x: x["score"], reverse=True)
        top = ranked[0]
        self.log(f"=== GAME OVER! {top['name']} ({top['clan']}) wins with {top['score']} Honor! ===")

    def serialize_for_player(self, viewer_id):
        masked_players = {}
        for pid, p in self.players.items():
            if pid == viewer_id or self.phase == "GAME_OVER":
                masked_players[pid] = {
                    **p,
                    "pool_count": len(p["pool"]),
                    "pool": []
                }
            else:
                masked_players[pid] = {
                    "id": p["id"],
                    "name": p["name"],
                    "clan": p["clan"],
                    "ready": p["ready"],
                    "connected": p["connected"],
                    "hand_count": len(p["hand"]),
                    "hand": [],
                    "pool_count": len(p["pool"]),
                    "discard": p["discard"],
                    "secret_objective": None,
                    "score": p["score"]
                }

        masked_tokens = []
        for pt in self.board["placed_tokens"]:
            if pt["is_face_down"] and pt["owner"] != viewer_id:
                masked_tokens.append({
                    "id": pt["id"],
                    "owner": pt["owner"],
                    "is_face_down": True,
                    "target_type": pt["target_type"],
                    "target_id": pt["target_id"],
                    "attack_target": pt["attack_target"],
                    "token": None
                })
            else:
                masked_tokens.append(pt)

        return {
            "round": self.round,
            "phase": self.phase,
            "turn_player_id": self.turn_player_id,
            "player_order": self.player_order,
            "players": masked_players,
            "board": {
                "provinces": self.board["provinces"],
                "borders": self.board["borders"],
                "placed_tokens": masked_tokens
            },
            "clans": CLANS,
            "logs": self.logs
        }


game = GameState()


# --- WEBSOCKET & HTTP HANDLERS ---

async def broadcast_state():
    for pid, ws in list(game.websockets.items()):
        if not ws.closed:
            state = game.serialize_for_player(pid)
            await ws.send_json({"type": "STATE_UPDATE", "state": state})

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    player_id = None

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                data = json.loads(msg.data)
                action = data.get("action")

                if action == "JOIN":
                    player_id = data.get("player_id") or str(uuid.uuid4())[:8]
                    name = data.get("name", f"Samurai-{player_id[:4]}")
                    game.add_player(player_id, name)
                    game.players[player_id]["connected"] = True
                    game.websockets[player_id] = ws
                    await ws.send_json({"type": "JOINED", "player_id": player_id})
                    await broadcast_state()

                elif action == "SELECT_CLAN" and player_id in game.players:
                    if game.phase == "LOBBY":
                        clan = data.get("clan")
                        taken = [p["clan"] for p in game.players.values() if p["id"] != player_id]
                        if clan in CLANS and clan not in taken:
                            game.players[player_id]["clan"] = clan
                            await broadcast_state()

                elif action == "TOGGLE_READY" and player_id in game.players:
                    if game.phase == "LOBBY" and game.players[player_id]["clan"]:
                        game.players[player_id]["ready"] = not game.players[player_id]["ready"]
                        if game.can_start():
                            game.start_game()
                        await broadcast_state()

                elif action == "PLACE_TOKEN" and player_id in game.players:
                    ok, err = game.place_token(
                        player_id,
                        data.get("token_id"),
                        data.get("target_type"),
                        data.get("target_id"),
                        data.get("attack_target")
                    )
                    if not ok:
                        await ws.send_json({"type": "ERROR", "message": err})
                    await broadcast_state()

                elif action == "NEXT_ROUND":
                    if game.phase == "RESOLUTION":
                        game.next_round()
                        await broadcast_state()

                elif action == "RESET_GAME":
                    ws_bak = game.websockets
                    game.init_board()
                    game.round = 1
                    game.phase = "LOBBY"
                    game.turn_player_id = None
                    game.player_order = []
                    game.first_player_idx = 0
                    game.logs = ["Game reset to Lobby."]
                    game.placements_this_round = 0
                    for p in game.players.values():
                        p["clan"] = None
                        p["ready"] = False
                        p["hand"] = []
                        p["pool"] = []
                        p["discard"] = []
                        p["secret_objective"] = None
                        p["bonus_honor"] = 0
                        p["score"] = 0
                    game.websockets = ws_bak
                    await broadcast_state()

    finally:
        if player_id and player_id in game.players:
            game.players[player_id]["connected"] = False
            await broadcast_state()

    return ws

async def index_handler(request):
    return web.FileResponse(os.path.join(STATIC_DIR, 'index.html'))

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

app = web.Application()
app.router.add_get('/', index_handler)
app.router.add_get('/ws', websocket_handler)
app.router.add_static('/static/', path=STATIC_DIR, name='static')

if __name__ == '__main__':
    lan_ip = get_lan_ip()
    port = 8080
    print("=" * 60)
    print("  BATTLE FOR ROKUGAN - LAN SERVER RUNNING")
    print(f"  Local Machine URL : http://localhost:{port}")
    print(f"  LAN Players URL   : http://{lan_ip}:{port}")
    print("=" * 60)
    web.run_app(app, host='0.0.0.0', port=port, print=None)
