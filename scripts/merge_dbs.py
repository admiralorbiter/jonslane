import os
import sqlite3

def merge_databases():
    base_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    instance_dir = os.path.join(base_dir, "instance")
    
    portfolio_db_path = os.path.join(instance_dir, "portfolio.db")
    cmi_db_path = os.path.join(instance_dir, "count_me_in.db")
    
    if not os.path.exists(cmi_db_path):
        print(f"[-] Source database not found at {cmi_db_path}. Nothing to merge.")
        return
        
    print(f"[*] Starting database merge from {cmi_db_path} into {portfolio_db_path}...")
    
    conn = sqlite3.connect(portfolio_db_path)
    cursor = conn.cursor()
    
    try:
        # Attach the count_me_in database
        cursor.execute(f"ATTACH DATABASE '{cmi_db_path}' AS cmi")
        
        # Verify table existence in both databases
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        main_tables = {row[0] for row in cursor.fetchall()}
        
        cursor.execute("SELECT name FROM cmi.sqlite_master WHERE type='table'")
        cmi_tables = {row[0] for row in cursor.fetchall()}
        
        tables_to_copy = ["crates", "challenges", "attempts", "reference_tracks"]
        
        for table in tables_to_copy:
            if table not in main_tables:
                print(f"[!] Target table '{table}' does not exist in portfolio.db yet. Skipping. Run app first.")
                continue
            if table not in cmi_tables:
                print(f"[-] Source table '{table}' does not exist in count_me_in.db. Skipping.")
                continue
                
            print(f"[*] Copying data for table '{table}'...")
            
            # Since columns match exactly (or target has new nullable/defaulted columns), 
            # we specify columns from source explicitly to match target columns.
            cursor.execute(f"PRAGMA cmi.table_info({table})")
            columns = [info[1] for info in cursor.fetchall()]
            cols_str = ", ".join(columns)
            
            cursor.execute(f"INSERT OR IGNORE INTO main.{table} ({cols_str}) SELECT {cols_str} FROM cmi.{table}")
            print(f"[+] Successfully copied '{table}' data. Rowcount: {cursor.rowcount}")
            
        conn.commit()
        print("[+] Commit successful.")
        
    except Exception as e:
        conn.rollback()
        print(f"[CRITICAL] Database merge failed: {e}")
        raise e
    finally:
        conn.close()
        
    # Archive the old database file
    archive_path = cmi_db_path + ".bak"
    try:
        if os.path.exists(archive_path):
            os.remove(archive_path)
        os.rename(cmi_db_path, archive_path)
        print(f"[+] Archived count_me_in.db to {archive_path}")
    except Exception as e:
        print(f"[!] Failed to rename count_me_in.db to bak: {e}")

if __name__ == "__main__":
    merge_databases()
