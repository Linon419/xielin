import { StrategyEngine } from '../strategyEngine';
import { StrategyInput } from '../../types/strategy';

describe('StrategyEngine', () => {
  let engine: StrategyEngine;

  beforeEach(() => {
    engine = new StrategyEngine();
  });

  describe('validateInput', () => {
    it('should return no errors for valid input', () => {
      const validInput: StrategyInput = {
        symbol: 'UXLINK',
        type: '兜底区',
        schellingPoint: 0.425,
        currentPrice: 0.430,
        atr4h: 0.020,
        atr15m: 0.008
      };

      const errors = engine.validateInput(validInput);
      expect(errors).toHaveLength(0);
    });

    it('should return error for empty symbol', () => {
      const invalidInput: StrategyInput = {
        symbol: '',
        type: '兜底区',
        schellingPoint: 0.425,
        currentPrice: 0.430,
        atr4h: 0.020,
        atr15m: 0.008
      };

      const errors = engine.validateInput(invalidInput);
      expect(errors).toContainEqual({
        field: 'symbol',
        message: '请输入币种名称'
      });
    });

    it('should return error for invalid price values', () => {
      const invalidInput: StrategyInput = {
        symbol: 'UXLINK',
        type: '兜底区',
        schellingPoint: -0.425,
        currentPrice: 0,
        atr4h: 0.020,
        atr15m: 0.008
      };

      const errors = engine.validateInput(invalidInput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'schellingPoint')).toBe(true);
      expect(errors.some(e => e.field === 'currentPrice')).toBe(true);
    });

    it('should return error for ATR values that are too large', () => {
      const invalidInput: StrategyInput = {
        symbol: 'UXLINK',
        type: '兜底区',
        schellingPoint: 0.425,
        currentPrice: 0.430,
        atr4h: 0.250, // 超过当前价格的50%
        atr15m: 0.200 // 超过当前价格的30%
      };

      const errors = engine.validateInput(invalidInput);
      expect(errors.some(e => e.field === 'atr4h')).toBe(true);
      expect(errors.some(e => e.field === 'atr15m')).toBe(true);
    });
  });

  describe('calculateLeverage', () => {
    it('should calculate leverage correctly for balanced risk', () => {
      const leverage = engine.calculateLeverage(0.020, 0.430, 'balanced');
      expect(leverage).toBeGreaterThan(0);
      expect(leverage).toBeLessThanOrEqual(25); // 平衡型最大杠杆
    });

    it('should respect conservative risk limits', () => {
      const leverage = engine.calculateLeverage(0.020, 0.430, 'conservative');
      expect(leverage).toBeLessThanOrEqual(10); // 保守型最大杠杆
    });

    it('should respect aggressive risk limits', () => {
      const leverage = engine.calculateLeverage(0.020, 0.430, 'aggressive');
      expect(leverage).toBeLessThanOrEqual(50); // 激进型最大杠杆
    });
  });

  describe('generateStrategy', () => {
    it('should generate support strategy for 兜底区', () => {
      const input: StrategyInput = {
        symbol: 'UXLINK',
        type: '兜底区',
        schellingPoint: 0.425,
        currentPrice: 0.430,
        atr4h: 0.020,
        atr15m: 0.008,
        riskPreference: 'balanced'
      };

      const result = engine.generateStrategy(input);
      
      expect(result.strategy).toBeDefined();
      expect(result.errors).toBeUndefined();
      
      if (result.strategy) {
        expect(result.strategy.basic.strategyName).toContain('兜底区滤波对冲策略');
        expect(result.strategy.basic.recommendedLeverage).toBeGreaterThan(0);
        expect(result.strategy.operations.entry.price).toBe(input.schellingPoint);
      }
    });

    it('should generate breakout strategy for 探顶区', () => {
      const input: StrategyInput = {
        symbol: 'SWARMS',
        type: '探顶区',
        schellingPoint: 0.850,
        currentPrice: 0.820,
        atr4h: 0.035,
        atr15m: 0.015,
        riskPreference: 'balanced'
      };

      const result = engine.generateStrategy(input);
      
      expect(result.strategy).toBeDefined();
      expect(result.errors).toBeUndefined();
      
      if (result.strategy) {
        expect(result.strategy.basic.strategyName).toContain('探顶区突破跟踪策略');
        expect(result.strategy.basic.recommendedLeverage).toBeGreaterThan(0);
        expect(result.strategy.operations.entry.price).toBeGreaterThan(input.schellingPoint);
      }
    });

    it('should return errors for invalid input', () => {
      const invalidInput: StrategyInput = {
        symbol: '',
        type: '兜底区',
        schellingPoint: -0.425,
        currentPrice: 0,
        atr4h: 0.020,
        atr15m: 0.008
      };

      const result = engine.generateStrategy(invalidInput);
      
      expect(result.errors).toBeDefined();
      expect(result.strategy).toBeUndefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should calculate risk metrics correctly', () => {
      const input: StrategyInput = {
        symbol: 'UXLINK',
        type: '兜底区',
        schellingPoint: 0.425,
        currentPrice: 0.430,
        atr4h: 0.020,
        atr15m: 0.008,
        riskPreference: 'balanced'
      };

      const result = engine.generateStrategy(input);
      
      if (result.strategy) {
        expect(result.strategy.basic.maxRisk).toBeGreaterThan(0);
        expect(result.strategy.basic.expectedReturn).toHaveLength(2);
        expect(result.strategy.basic.expectedReturn[0]).toBeLessThan(result.strategy.basic.expectedReturn[1]);
        expect(result.strategy.basic.confidence).toBeGreaterThanOrEqual(0);
        expect(result.strategy.basic.confidence).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('risk analysis', () => {
    it('should provide appropriate risk level based on leverage', () => {
      const highLeverageInput: StrategyInput = {
        symbol: 'UXLINK',
        type: '兜底区',
        schellingPoint: 0.425,
        currentPrice: 0.430,
        atr4h: 0.010, // 小ATR会导致高杠杆
        atr15m: 0.005,
        riskPreference: 'aggressive'
      };

      const result = engine.generateStrategy(highLeverageInput);
      
      if (result.strategy && result.strategy.basic.recommendedLeverage > 20) {
        expect(result.strategy.basic.riskLevel).toBe('high');
      }
    });

    it('should provide risk mitigation strategies', () => {
      const input: StrategyInput = {
        symbol: 'UXLINK',
        type: '兜底区',
        schellingPoint: 0.425,
        currentPrice: 0.430,
        atr4h: 0.020,
        atr15m: 0.008
      };

      const result = engine.generateStrategy(input);
      
      if (result.strategy) {
        expect(result.strategy.risks.primaryRisks.length).toBeGreaterThan(0);
        expect(result.strategy.risks.mitigation.length).toBeGreaterThan(0);
        expect(result.strategy.risks.worstCase).toBeDefined();
      }
    });
  });
});
