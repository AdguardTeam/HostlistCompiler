const ruleUtils = require('../src/rule');

describe('Rule utils', () => {
    it('check if /etc/hosts rule', () => {
        expect(ruleUtils.isEtcHostsRule('0.0.0.0 example.org')).toBe(true);
        expect(ruleUtils.isEtcHostsRule('[::]    example.org  ya.ru')).toBe(true);
        expect(ruleUtils.isEtcHostsRule(':: example.org')).toBe(true);
        expect(ruleUtils.isEtcHostsRule('0.0.0.0 example.org # this is a comment')).toBe(true);
        expect(ruleUtils.isEtcHostsRule('fe80::1%lo0 localhost')).toBe(true);
        expect(ruleUtils.isEtcHostsRule('ff02::3 ip6-allhosts')).toBe(true);

        expect(ruleUtils.isEtcHostsRule('example.org')).toBe(false);
        expect(ruleUtils.isEtcHostsRule('0.0.0.0')).toBe(false);
        expect(ruleUtils.isEtcHostsRule('||example.org^')).toBe(false);
        expect(ruleUtils.isEtcHostsRule('! 0.0.0.0 example.org')).toBe(false);
    });

    it('load /etc/hosts rule properties', () => {
        let props = ruleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org');
        expect(props.hostnames).toHaveLength(1);
        expect(props.hostnames[0]).toBe('example.org');
        expect(props.ruleText).toBe('0.0.0.0 example.org');

        props = ruleUtils.loadEtcHostsRuleProperties('[::]    example.org  ya.ru');
        expect(props.hostnames).toHaveLength(2);
        expect(props.hostnames[0]).toBe('example.org');
        expect(props.hostnames[1]).toBe('ya.ru');
        expect(props.ruleText).toBe('[::]    example.org  ya.ru');

        props = ruleUtils.loadEtcHostsRuleProperties('0.0.0.0 example.org # this is a comment');
        expect(props.hostnames).toHaveLength(1);
        expect(props.hostnames[0]).toBe('example.org');
        expect(props.ruleText).toBe('0.0.0.0 example.org # this is a comment');

        props = ruleUtils.loadEtcHostsRuleProperties('ff02::3 ip6-allhosts');
        expect(props.hostnames).toHaveLength(1);
        expect(props.hostnames[0]).toBe('ip6-allhosts');
        expect(props.ruleText).toBe('ff02::3 ip6-allhosts');
    });

    it('load invalid /etc/hosts rule', () => {
        expect(() => {
            ruleUtils.loadEtcHostsRuleProperties('0.0.0.0');
        }).toThrow(TypeError);
    });

    it('load adblock-style rule properties', () => {
        let props = ruleUtils.loadAdblockRuleProperties('||example.org^');
        expect(props.whitelist).toBe(false);
        expect(props.pattern).toBe('||example.org^');
        expect(props.options).toBe(null);
        expect(props.ruleText).toBe('||example.org^');
        expect(props.hostname).toBe('example.org');

        props = ruleUtils.loadAdblockRuleProperties('@@||example.org^');
        expect(props.whitelist).toBe(true);
        expect(props.pattern).toBe('||example.org^');
        expect(props.options).toBe(null);
        expect(props.ruleText).toBe('@@||example.org^');
        expect(props.hostname).toBe('example.org');

        props = ruleUtils.loadAdblockRuleProperties('||example.org^$third-party');
        expect(props.whitelist).toBe(false);
        expect(props.pattern).toBe('||example.org^');
        expect(props.options).toHaveLength(1);
        expect(props.options[0].name).toBe('third-party');
        expect(props.ruleText).toBe('||example.org^$third-party');
        expect(props.hostname).toBe('example.org');

        props = ruleUtils.loadAdblockRuleProperties('||example.org^$third-party,domain=ex1.org|ex2.org');
        expect(props.whitelist).toBe(false);
        expect(props.pattern).toBe('||example.org^');
        expect(props.options).toHaveLength(2);
        expect(props.options[0].name).toBe('third-party');
        expect(props.options[0].value).toBe(null);
        expect(props.options[1].name).toBe('domain');
        expect(props.options[1].value).toBe('ex1.org|ex2.org');
        expect(props.ruleText).toBe('||example.org^$third-party,domain=ex1.org|ex2.org');
        expect(props.hostname).toBe('example.org');

        props = ruleUtils.loadAdblockRuleProperties('@@/example.org$/');
        expect(props.whitelist).toBe(true);
        expect(props.pattern).toBe('/example.org$/');
        expect(props.options).toBe(null);
        expect(props.ruleText).toBe('@@/example.org$/');
    });

    it('findModifier should work', () => {
        const props = ruleUtils.loadAdblockRuleProperties('@@||example.org^$third-party,domain=example.org');
        expect(props.options).toHaveLength(2);

        expect(ruleUtils.findModifier(props, 'test')).toBe(null);
        expect(ruleUtils.findModifier(props, 'third-party')).toBeTruthy();
        expect(ruleUtils.findModifier(props, 'domain')).toBeTruthy();
    });

    it('removeModifier should work', () => {
        const props = ruleUtils.loadAdblockRuleProperties('||example.org^$third-party,domain=example.org');
        expect(props.options).toHaveLength(2);

        expect(ruleUtils.findModifier(props, 'test')).toBe(null);
        expect(ruleUtils.findModifier(props, 'third-party')).toBeTruthy();
        expect(ruleUtils.findModifier(props, 'domain')).toBeTruthy();

        expect(ruleUtils.removeModifier(props, 'test')).toBe(false);
        expect(props.options).toHaveLength(2);

        expect(ruleUtils.removeModifier(props, 'third-party')).toBe(true);
        expect(props.options).toHaveLength(1);
        expect(ruleUtils.adblockRuleToString(props)).toBe('||example.org^$domain=example.org');

        expect(ruleUtils.removeModifier(props, 'domain')).toBe(true);
        expect(props.options).toHaveLength(0);
        expect(ruleUtils.adblockRuleToString(props)).toBe('||example.org^');
    });

    it('isJustDomain should work', () => {
        expect(ruleUtils.isJustDomain('example.org')).toBe(true);
        expect(ruleUtils.isJustDomain('subdomain.example.org')).toBe(true);
        expect(ruleUtils.isJustDomain('sub.sub.example.org')).toBe(true);

        expect(ruleUtils.isJustDomain('')).toBe(false);
        expect(ruleUtils.isJustDomain('example')).toBe(false);
        expect(ruleUtils.isJustDomain('123*org')).toBe(false);
        expect(ruleUtils.isJustDomain('||example.org^')).toBe(false);
        expect(ruleUtils.isJustDomain('123 org')).toBe(false);
    });
});
