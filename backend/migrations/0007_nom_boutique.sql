-- Une boutique porte le nom de sa Page Facebook (plus de « Boutique principale »), et la boutique
-- d'origine reçoit un vrai code d'activation KD-XXXX-XXXX, comme les autres.
UPDATE shops SET name = page_name WHERE page_name IS NOT NULL;
UPDATE shops
SET activation_code = 'KD-' || substr(upper(hex(randomblob(2))), 1, 4) || '-' || substr(upper(hex(randomblob(2))), 1, 4)
WHERE activation_code LIKE 'DEFAULT-%';
