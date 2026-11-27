"""Independent random resource identity; never payment or authorization proof."""
import secrets

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def make_reference(kind):
    random = "".join(secrets.choice(ALPHABET) for _ in range(12))
    return "OC-" + kind + "-" + "-".join(random[i:i+4] for i in range(0, 12, 4))

def reference_acc():
    return make_reference("ACC")

def reference_inv():
    return make_reference("INV")

def reference_qte():
    return make_reference("QTE")

def reference_ord():
    return make_reference("ORD")

def reference_svc():
    return make_reference("SVC")

def reference_dom():
    return make_reference("DOM")

def reference_txn():
    return make_reference("TXN")

def reference_tkt():
    return make_reference("TKT")

def reference_wlt():
    return make_reference("WLT")
